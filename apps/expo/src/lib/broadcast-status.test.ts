import { describe, expect, it } from "vitest"

import type { PublicPosition } from "@omasla/convex"

import type { WarningInput } from "./broadcast-status"
import {
  autoStopDeadline,
  broadcastPoint,
  broadcastWarnings,
  formatAge,
  formatClock,
  formatDuration,
  formatElapsed,
  formatRemaining,
  ownsTrackingFeedback,
  pointLabel,
} from "./broadcast-status"

const s = 1_000
const min = 60 * s
const h = 60 * min

const position = (overrides: Partial<PublicPosition>): PublicPosition =>
  ({
    id: "p1",
    latitude: 16.24,
    longitude: -61.53,
    source: "referent",
    observedAt: null,
    receivedAt: 0,
    timestampBasis: "received",
    ...overrides,
  }) as PublicPosition

describe("durations", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(-5)).toBe("0 s")
    expect(formatDuration(12 * s + 900)).toBe("12 s")
    expect(formatDuration(42 * min + 30 * s)).toBe("42 min")
    expect(formatDuration(3 * h + 5 * min)).toBe("3 h 05")
    expect(formatDuration(3 * h + 18 * min)).toBe("3 h 18")
  })
  it("words elapsed time, age and remaining time", () => {
    expect(formatElapsed(20 * s)).toBe("depuis moins d’une minute")
    expect(formatElapsed(42 * min)).toBe("depuis 42 min")
    expect(formatAge(2 * s)).toBe("à l’instant")
    expect(formatAge(12 * s)).toBe("il y a 12 s")
    expect(formatRemaining(3 * h + 18 * min + 40 * s)).toBe("dans 3 h 18")
    expect(formatRemaining(30 * s)).toBe("dans moins d’une minute")
    expect(formatRemaining(0)).toBe("imminent")
  })
  it("formats a local clock time", () => {
    expect(formatClock(new Date(2027, 0, 3, 23, 5).getTime())).toBe("23:05")
  })
})

describe("broadcastPoint", () => {
  const session = { startedAt: 10 * min }
  it("waits for the first point just after the start", () => {
    expect(broadcastPoint(session, null, 11 * min)).toEqual({ kind: "waiting" })
  })
  it("reports a missing point once the start is old enough", () => {
    expect(broadcastPoint(session, null, 13 * min)).toEqual({
      kind: "missing",
      sinceMs: 3 * min,
    })
  })
  it("ignores a public observation or a point from before the session", () => {
    expect(
      broadcastPoint(
        session,
        position({ source: "community", receivedAt: 11 * min }),
        11 * min + 30 * s,
      ),
    ).toEqual({ kind: "waiting" })
    expect(
      broadcastPoint(session, position({ receivedAt: 9 * min }), 11 * min).kind,
    ).toBe("waiting")
  })
  it("tells fresh from late points", () => {
    const point = position({ receivedAt: 20 * min })
    expect(broadcastPoint(session, point, 20 * min + 12 * s)).toEqual({
      kind: "fresh",
      ageMs: 12 * s,
    })
    expect(broadcastPoint(session, point, 25 * min).kind).toBe("late")
    expect(broadcastPoint(session, point, 19 * min)).toEqual({
      kind: "fresh",
      ageMs: 0,
    })
  })
  it("labels each state", () => {
    expect(pointLabel({ kind: "fresh", ageMs: 12 * s })).toBe(
      "Dernier point envoyé il y a 12 s",
    )
    expect(pointLabel({ kind: "missing", sinceMs: 4 * min })).toBe(
      "Aucun point reçu depuis 4 min",
    )
    expect(pointLabel({ kind: "waiting" })).toMatch(/Premier point/)
  })
})

describe("autoStopDeadline", () => {
  it("flags the last quarter hour", () => {
    expect(autoStopDeadline({ expiresAt: 4 * h }, h)).toEqual({
      remainingMs: 3 * h,
      at: 4 * h,
      soon: false,
    })
    expect(autoStopDeadline({ expiresAt: 4 * h }, 4 * h - 10 * min).soon).toBe(
      true,
    )
  })
})

const calm: WarningInput = {
  ownDevice: true,
  offline: false,
  running: true,
  pendingStop: false,
  trackingError: null,
  notificationsAllowed: true,
  speedWarning: false,
  point: { kind: "fresh", ageMs: 5 * s },
  deadline: { remainingMs: 2 * h, at: 3 * h, soon: false },
  handoffPending: false,
}

describe("broadcastWarnings", () => {
  it("is empty when everything runs", () => {
    expect(broadcastWarnings(calm)).toEqual([])
  })
  it("groups every warning, most serious first", () => {
    const keys = broadcastWarnings({
      ...calm,
      notificationsAllowed: false,
      handoffPending: true,
      speedWarning: true,
      point: { kind: "late", ageMs: 5 * min },
      deadline: { remainingMs: 5 * min, at: 3 * h, soon: true },
      trackingError: "Autorise la localisation Toujours.",
    }).map((warning) => warning.key)
    expect(keys).toEqual([
      "error",
      "speed",
      "point",
      "deadline",
      "notifications",
      "handoff",
    ])
  })
  it("prefers the pending stop over the not-running warning", () => {
    const keys = broadcastWarnings({
      ...calm,
      running: false,
      pendingStop: true,
    }).map((warning) => warning.key)
    expect(keys).toEqual(["pending-stop"])
    expect(
      broadcastWarnings({ ...calm, running: false }).map((w) => w.key),
    ).toEqual(["not-running"])
  })
  it("does not blame the network twice when offline", () => {
    const keys = broadcastWarnings({
      ...calm,
      offline: true,
      point: { kind: "missing", sinceMs: 5 * min },
    }).map((warning) => warning.key)
    expect(keys).toEqual(["offline"])
  })
  it("keeps phone-specific warnings for the emitting phone", () => {
    const keys = broadcastWarnings({
      ...calm,
      ownDevice: false,
      running: false,
      notificationsAllowed: false,
      point: { kind: "late", ageMs: 3 * min },
    }).map((warning) => warning.key)
    expect(keys).toEqual(["point"])
  })
})

describe("ownsTrackingFeedback", () => {
  it("belongs to the emitting phone or to the member offered the handoff", () => {
    const base = { isEmitter: true, deviceId: "phone-a" }
    expect(ownsTrackingFeedback(base, "phone-a", "acc-1")).toBe(true)
    expect(ownsTrackingFeedback(base, "phone-b", "acc-1")).toBe(false)
    expect(
      ownsTrackingFeedback(
        {
          isEmitter: false,
          deviceId: "phone-a",
          handoffToAccountId: "acc-2" as never,
        },
        "phone-b",
        "acc-2",
      ),
    ).toBe(true)
    expect(
      ownsTrackingFeedback(
        { isEmitter: false, deviceId: "phone-a" },
        "phone-b",
        "acc-2",
      ),
    ).toBe(false)
  })
  it("adds a failed handoff to the grouped list", () => {
    expect(
      broadcastWarnings({ ...calm, handoffError: "Réessaie." }).map(
        (w) => w.key,
      ),
    ).toEqual(["handoff-error"])
  })
})
