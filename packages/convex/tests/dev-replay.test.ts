import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../convex/_generated/api"
import schema from "../convex/schema"

const modules = import.meta.glob("../convex/**/!(*.test|auth.config)*.ts")

// Fictional groups and coordinates, test only.
async function setup() {
  const t = convexTest(schema, modules)
  const [alpha, beta] = await t.run(async (ctx) => [
    await ctx.db.insert("groups", { title: "Groupe fictif A", isLive: false }),
    await ctx.db.insert("groups", { title: "Groupe fictif B", isLive: false }),
  ])
  return { t, alpha, beta }
}
const sample = (title: string, live: boolean) => ({
  title,
  latitude: 16.24,
  longitude: -61.53,
  live,
})

describe("devReplay", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 10, 28, 20))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it("is refused unless the deployment opts in", async () => {
    const { t } = await setup()
    await expect(
      t.mutation(internal.devReplay.ensurePolicy, {}),
    ).rejects.toThrow(/DEV_REPLAY_DISABLED/)
    await expect(
      t.mutation(internal.devReplay.push, {
        runId: "test",
        seq: 0,
        samples: [sample("Groupe fictif A", true)],
      }),
    ).rejects.toThrow(/DEV_REPLAY_DISABLED/)
  })

  it("replays live and public positions, then ends and purges them", async () => {
    vi.stubEnv("ALLOW_DEV_REPLAY", "true")
    const { t, alpha, beta } = await setup()
    expect(
      (await t.mutation(internal.devReplay.ensurePolicy, {})).created,
    ).toBe(true)
    const result = await t.mutation(internal.devReplay.push, {
      runId: "test",
      seq: 0,
      samples: [
        sample("Groupe fictif A", true),
        sample("Groupe fictif B", false),
        sample("Groupe absent", false),
      ],
    })
    expect(result).toEqual({
      written: 2,
      missingGroup: ["Groupe absent"],
      busy: 0,
    })
    let catalog = await t.query(api.catalog.list, {})
    const a = catalog.groups.find((g) => g.id === alpha)
    const b = catalog.groups.find((g) => g.id === beta)
    expect(a?.live).toBe(true)
    expect(a?.position?.source).toBe("referent")
    expect(b?.live).toBe(false)
    expect(b?.position?.source).toBe("community")
    // A public sample is not written over a live group.
    const busy = await t.mutation(internal.devReplay.push, {
      runId: "test",
      seq: 1,
      samples: [sample("Groupe fictif A", false)],
    })
    expect(busy.busy).toBe(1)

    expect(await t.mutation(internal.devReplay.end, { runId: "test" })).toEqual(
      { ended: 1 },
    )
    catalog = await t.query(api.catalog.list, {})
    expect(catalog.groups.find((g) => g.id === alpha)?.live).toBe(false)

    expect(await t.query(internal.devReplay.status, {})).toEqual({
      positions: 2,
      liveSessions: 0,
    })
    expect(await t.mutation(internal.devReplay.purge, {})).toEqual({
      deleted: 2,
      done: true,
    })
    catalog = await t.query(api.catalog.list, {})
    expect(catalog.groups.every((g) => g.position === null)).toBe(true)
  })

  it("never takes over a group that is already live", async () => {
    vi.stubEnv("ALLOW_DEV_REPLAY", "true")
    const { t, alpha } = await setup()
    await t.mutation(internal.devReplay.ensurePolicy, {})
    await t.mutation(internal.devReplay.push, {
      runId: "first",
      seq: 0,
      samples: [sample("Groupe fictif A", true)],
    })
    const other = await t.mutation(internal.devReplay.push, {
      runId: "second",
      seq: 0,
      samples: [sample("Groupe fictif A", true)],
    })
    expect(other).toMatchObject({ written: 0, busy: 1 })
    const groups = (await t.query(api.catalog.list, {})).groups
    expect(groups.find((g) => g.id === alpha)?.live).toBe(true)
  })
})
