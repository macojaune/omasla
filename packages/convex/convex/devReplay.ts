import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery } from "./_generated/server"
import { endSession } from "./lib/live"
import { fail } from "./lib/security"

/**
 * DEV-only replay of past outings (MAR-465). Every row written here is tagged
 * `replay:<runId>:…` and attributed to the replay account, so it can be told
 * apart from real data and purged. Refused unless the deployment opts in with
 * ALLOW_DEV_REPLAY=true, which is never set in production.
 */
const REPLAY_TOKEN = "omasla-dev-replay|replay"
export const REPLAY_PREFIX = "replay:"

function requireReplay() {
  if (process.env.ALLOW_DEV_REPLAY !== "true") fail("DEV_REPLAY_DISABLED")
}
function checkRunId(runId: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(runId)) fail("INVALID_RUN_ID")
}
async function replayAccount(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("accounts")
    .withIndex("by_identity", (q) => q.eq("tokenIdentifier", REPLAY_TOKEN))
    .unique()
  if (existing) return existing._id
  return ctx.db.insert("accounts", {
    tokenIdentifier: REPLAY_TOKEN,
    subject: "replay",
    issuer: "omasla-dev-replay",
    displayName: "[REJEU] Membre simulé",
    role: "spectator",
  })
}

/** DEV fallback policy, only created when the deployment has none. Values are a test baseline, not a production decision. */
export const ensurePolicy = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireReplay()
    const current = await ctx.db.query("trackingPolicies").order("desc").first()
    if (current) return { created: false, policyId: current._id }
    const accountId = await replayAccount(ctx)
    const policyId = await ctx.db.insert("trackingPolicies", {
      createdBy: accountId,
      createdAt: Date.now(),
      policy: {
        freshForMs: 5 * 60_000,
        hideAfterMs: 45 * 60_000,
        maxDurationMs: 8 * 3_600_000,
        maxFutureSkewMs: 60_000,
        maxSampleAgeMs: 5 * 60_000,
        maxAccuracyMeters: 100,
        zone: {
          latitude: 16.2411,
          longitude: -61.5331,
          radiusMeters: 60_000,
          confirmationMs: 120_000,
        },
        speed: {
          thresholdMps: 15,
          persistenceMs: 120_000,
          warningMs: 120_000,
          maxGapMs: 300_000,
        },
      },
    })
    return { created: true, policyId }
  },
})

async function groupByTitle(ctx: MutationCtx, title: string) {
  return ctx.db
    .query("groups")
    .filter((q) => q.eq(q.field("title"), title))
    .first()
}
async function replaySession(
  ctx: MutationCtx,
  runId: string,
  group: Doc<"groups">,
  accountId: Id<"accounts">,
) {
  const deviceId = `${REPLAY_PREFIX}${runId}`
  if (group.activeSessionId) {
    const active = await ctx.db.get(group.activeSessionId)
    if (active?.status === "active" && active.expiresAt > Date.now())
      return active.deviceId === deviceId ? active : null
  }
  const policy = await ctx.db.query("trackingPolicies").order("desc").first()
  if (!policy) return fail("CONFIGURATION_REQUIRED")
  const now = Date.now()
  const id = await ctx.db.insert("liveSessions", {
    groupId: group._id,
    status: "active",
    emitterAccountId: accountId,
    emitterAuthSessionId: deviceId,
    deviceId,
    generation: 1,
    generationStartedAt: now,
    startedBy: accountId,
    startRequestId: `${deviceId}:${group._id}`,
    startedAt: now,
    expiresAt: now + policy.policy.maxDurationMs,
    policyId: policy._id,
    policy: policy.policy,
  })
  await ctx.db.patch(group._id, { activeSessionId: id, isLive: true })
  await ctx.scheduler.runAt(
    now + policy.policy.maxDurationMs,
    internal.sessions.expire,
    { sessionId: id },
  )
  return ctx.db.get(id)
}

/** Writes one tick of a replay at the current server time. */
export const push = internalMutation({
  args: {
    runId: v.string(),
    seq: v.number(),
    samples: v.array(
      v.object({
        title: v.string(),
        latitude: v.number(),
        longitude: v.number(),
        live: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    requireReplay()
    checkRunId(args.runId)
    if (args.samples.length > 100) fail("TOO_MANY_SAMPLES")
    const accountId = await replayAccount(ctx)
    const now = Date.now()
    const result = { written: 0, missingGroup: [] as string[], busy: 0 }
    for (const [index, sample] of args.samples.entries()) {
      if (Math.abs(sample.latitude) > 90 || Math.abs(sample.longitude) > 180)
        fail("INVALID_COORDINATES")
      const group = await groupByTitle(ctx, sample.title)
      if (!group) {
        result.missingGroup.push(sample.title)
        continue
      }
      const tag = `${REPLAY_PREFIX}${args.runId}:${args.seq}:${index}`
      if (sample.live) {
        const session = await replaySession(ctx, args.runId, group, accountId)
        if (!session) {
          result.busy++
          continue
        }
        const id = await ctx.db.insert("positions", {
          group: group._id,
          latitude: sample.latitude,
          longitude: sample.longitude,
          fromApp: true,
          source: "referent",
          accountId,
          observedAt: now,
          receivedAt: now,
          sessionId: session._id,
          generation: session.generation,
          sampleId: tag,
        })
        await ctx.db.patch(session._id, {
          lastPositionId: id,
          lastObservedAt: now,
        })
        await ctx.db.patch(group._id, { lastPositionId: id })
      } else {
        if (group.activeSessionId) {
          const active = await ctx.db.get(group.activeSessionId)
          if (active?.status === "active" && active.expiresAt > now) {
            result.busy++
            continue
          }
        }
        const id = await ctx.db.insert("positions", {
          group: group._id,
          latitude: sample.latitude,
          longitude: sample.longitude,
          fromApp: false,
          source: "community",
          accountId,
          observedAt: now,
          receivedAt: now,
          requestId: tag,
        })
        await ctx.db.patch(group._id, { lastPositionId: id })
      }
      result.written++
    }
    return result
  },
})

/** Ends the live sessions opened by a replay run. Positions stay until purge. */
export const end = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    requireReplay()
    checkRunId(args.runId)
    const deviceId = `${REPLAY_PREFIX}${args.runId}`
    const active = await ctx.db
      .query("liveSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect()
    let ended = 0
    for (const session of active)
      if (session.deviceId === deviceId) {
        await endSession(ctx, session, "manual")
        ended++
      }
    return { ended }
  },
})

function isReplay(position: Doc<"positions">) {
  return (position.sampleId ?? position.requestId ?? "").startsWith(
    REPLAY_PREFIX,
  )
}

/** Deletes replay positions (all runs) in batches and restores each group's last real position. Run until done is true. */
export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireReplay()
    const accountId = await replayAccount(ctx)
    const batch = (
      await ctx.db
        .query("positions")
        .filter((q) => q.eq(q.field("accountId"), accountId))
        .take(500)
    ).filter(isReplay)
    const groups = new Set<Id<"groups">>()
    for (const position of batch) {
      groups.add(position.group)
      await ctx.db.delete(position._id)
    }
    for (const groupId of groups) {
      const group = await ctx.db.get(groupId)
      if (!group) continue
      const session = group.activeSessionId
        ? await ctx.db.get(group.activeSessionId)
        : null
      if (session?.emitterAccountId === accountId)
        await endSession(ctx, session, "manual")
      const previous = await ctx.db
        .query("positions")
        .withIndex("by_group", (q) => q.eq("group", groupId))
        .order("desc")
        .filter((q) => q.eq(q.field("withdrawnAt"), undefined))
        .first()
      await ctx.db.patch(groupId, { lastPositionId: previous?._id })
    }
    return { deleted: batch.length, done: batch.length < 500 }
  },
})

export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_identity", (q) => q.eq("tokenIdentifier", REPLAY_TOKEN))
      .unique()
    if (!account) return { positions: 0, liveSessions: 0 }
    const positions = await ctx.db
      .query("positions")
      .filter((q) => q.eq(q.field("accountId"), account._id))
      .collect()
    const live = await ctx.db
      .query("liveSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect()
    return {
      positions: positions.length,
      liveSessions: live.filter((s) => s.emitterAccountId === account._id)
        .length,
    }
  },
})
