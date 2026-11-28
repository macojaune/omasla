/**
 * Replays a past outing on a DEV Convex deployment (MAR-465).
 *
 *   node scripts/dev-replay.mjs play  --deployment <dev-name> --source positions.jsonl --groups groups.jsonl \
 *        --night 2026-02-08 [--from 17:00] [--to 03:00] [--speed 10] [--tick 10] [--run <id>]
 *   node scripts/dev-replay.mjs end   --deployment <dev-name> --run <id>
 *   node scripts/dev-replay.mjs purge --deployment <dev-name>
 *   node scripts/dev-replay.mjs status --deployment <dev-name>
 *
 * Source files are JSONL exports of the legacy `positions` and `groups` tables
 * (see README). Only the group title, coordinates, time and the fromApp flag are
 * read: account and user identifiers are dropped. Times are Guadeloupe local time.
 * Groups are matched by exact title; samples are rewritten at the current time.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

const PRODUCTION = new Set(["useful-cassowary-315"])
const TZ_OFFSET_MS = -4 * 3_600_000

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    deployment: { type: "string" },
    source: { type: "string" },
    groups: { type: "string" },
    night: { type: "string" },
    from: { type: "string", default: "17:00" },
    to: { type: "string", default: "03:00" },
    speed: { type: "string", default: "10" },
    tick: { type: "string", default: "10" },
    run: { type: "string" },
  },
})
const command = positionals[0] ?? "status"
const deployment = values.deployment
assert.ok(deployment, "--deployment is required (never implied)")
assert.ok(!PRODUCTION.has(deployment), "Refusing the production deployment")
for (const name of ["CONVEX_DEPLOY_KEY", "CONVEX_SELF_HOSTED_URL"])
  assert.ok(process.env[name] === undefined, `Refusing ambient ${name}`)

function run(fn, args = {}) {
  const out = execFileSync(
    "npx",
    ["convex", "run", "--deployment", deployment, fn, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
  return out.trim() ? JSON.parse(out) : null
}

function localTime(date, hhmm, nextDay = false) {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = hhmm.split(":").map(Number)
  return Date.UTC(y, m - 1, d + (nextDay ? 1 : 0), h, min) - TZ_OFFSET_MS
}

function load() {
  assert.ok(values.source && values.groups && values.night, "Missing inputs")
  assert.match(values.night, /^\d{4}-\d{2}-\d{2}$/)
  const titles = new Map(
    readFileSync(values.groups, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((group) => [group._id, group.title]),
  )
  const start = localTime(values.night, values.from)
  const end = localTime(values.night, values.to, values.to < values.from)
  return readFileSync(values.source, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((p) => p._creationTime >= start && p._creationTime <= end)
    .map((p) => ({
      at: p._creationTime - start,
      title: titles.get(p.group),
      latitude: p.latitude,
      longitude: p.longitude,
      live: p.fromApp === true,
    }))
    .filter((p) => p.title)
    .sort((a, b) => a.at - b.at)
}

if (command === "status") console.log(run("devReplay:status"))
else if (command === "end") {
  assert.ok(values.run, "--run is required")
  console.log(run("devReplay:end", { runId: values.run }))
} else if (command === "purge") {
  for (;;) {
    const result = run("devReplay:purge")
    console.log(result)
    if (result.done) break
  }
} else if (command === "play") {
  const samples = load()
  assert.ok(samples.length, "No sample in this window")
  const speed = Number(values.speed)
  const tickMs = Number(values.tick) * 1000
  assert.ok(speed > 0 && tickMs >= 2000)
  const runId =
    values.run ?? `${values.night}-${Date.now().toString(36)}`.toLowerCase()
  const duration = samples.at(-1).at / speed
  console.log(
    `Run ${runId}: ${samples.length} samples, ${new Set(samples.map((s) => s.title)).size} groups, ~${Math.round(duration / 60_000)} min at x${speed}`,
  )
  console.log(run("devReplay:ensurePolicy"))
  const startedAt = Date.now()
  let cursor = 0
  let seq = 0
  let stopping = false
  process.on("SIGINT", () => (stopping = true))
  while (cursor < samples.length && !stopping) {
    const elapsed = (Date.now() - startedAt) * speed
    const due = new Map()
    while (cursor < samples.length && samples[cursor].at <= elapsed) {
      const sample = samples[cursor++]
      due.set(sample.title, sample)
    }
    if (due.size) {
      const batch = [...due.values()].map(({ at: _at, ...rest }) => rest)
      for (let i = 0; i < batch.length; i += 100) {
        const result = run("devReplay:push", {
          runId,
          seq: seq++,
          samples: batch.slice(i, i + 100),
        })
        console.log(
          `${new Date().toLocaleTimeString("fr-FR")} ${cursor}/${samples.length}`,
          result,
        )
      }
    }
    await new Promise((resolve) => setTimeout(resolve, tickMs))
  }
  console.log(run("devReplay:end", { runId }))
} else assert.fail(`Unknown command ${command}`)
