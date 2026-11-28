import { describe, expect, it } from "vitest"

import type { Id, PublicCatalog, PublicGroup } from "@omasla/convex"

import type { Bounds } from "./map-view"
import {
  carouselGroups,
  distanceLabel,
  distanceMeters,
  groupAction,
  inBounds,
  mapGroups,
  overviewPoints,
  sameBounds,
  searchGroups,
  spotCounts,
  spotState,
} from "./map-view"

// Fictional data exclusively for testing: names, places and times are invented.
const now = 1_700_000_000_000
const position = (
  source: "referent" | "community" | "legacy",
  age: number,
  latitude = 16.24,
  longitude = -61.53,
): PublicGroup["position"] => ({
  id: `p-${source}-${age}-${latitude}` as Id<"positions">,
  latitude,
  longitude,
  source,
  observedAt: now - age,
  receivedAt: now - age,
  timestampBasis: "observed",
})
const group = (
  title: string,
  live: boolean,
  value: PublicGroup["position"],
  canObserve = !live,
): PublicGroup => ({
  id: title as Id<"groups">,
  title,
  live,
  canObserve,
  position: value,
})
const policy = { freshForMs: 600_000, hideAfterMs: 3_600_000 }
const catalog = (groups: PublicGroup[]): PublicCatalog => ({
  serverNow: now,
  policy,
  groups,
})
// Around a fictional square; the frame covers it but not the far point.
const frame: Bounds = [-61.54, 16.23, -61.52, 16.25]
const live = group("Élan", true, position("referent", 30_000))
const seen = group("Brise", false, position("community", 300_000, 16.245))
const aging = group("Clair", false, position("community", 1_200_000, 16.235))
const far = group("Lointain", false, position("community", 60_000, 16.3))
const old = group("Ancien", false, position("community", 7_200_000))
const none = group("Attente", false, null)
const all = catalog([live, seen, aging, far, old, none])

describe("map state and filter chips", () => {
  it("classifies like « Ce soir » and counts every spotted group", () => {
    expect(spotState(live, all, now)).toBe("live")
    expect(spotState(seen, all, now)).toBe("seen")
    expect(spotState(aging, all, now)).toBe("seen")
    expect(spotState(old, all, now)).toBe("unseen")
    expect(spotState(none, all, now)).toBe("unseen")
    expect(spotCounts(all, now)).toEqual({ live: 1, seen: 3, spotted: 4 })
  })
  it("a live flag without a recent member point is not « en direct »", () => {
    const waiting = group("Muet", true, null)
    const stale = group("Figé", true, position("referent", 1_200_000))
    expect(spotState(waiting, all, now)).toBe("unseen")
    expect(spotState(stale, all, now)).toBe("seen")
  })
  it("draws only spotted groups matching the chip and the accent-free search", () => {
    const titles = (filter: "all" | "live" | "seen", query = "") =>
      mapGroups(all, now, { filter, query }).map((item) => item.title)
    expect(titles("all")).toEqual(["Élan", "Brise", "Clair", "Lointain"])
    expect(titles("live")).toEqual(["Élan"])
    expect(titles("seen")).toEqual(["Brise", "Clair", "Lointain"])
    expect(titles("all", " elan ")).toEqual(["Élan"])
    expect(titles("live", "brise")).toEqual([])
  })
  it("search also finds groups without a point, spotted ones first", () => {
    expect(searchGroups(all, now, "")).toEqual([])
    expect(searchGroups(all, now, "a").map((item) => item.title)).toStrictEqual(
      ["Élan", "Clair", "Lointain", "Ancien", "Attente"],
    )
  })
})

describe("visible frame and carousel order", () => {
  it("keeps points inside the frame, borders included, across the antimeridian", () => {
    expect(inBounds({ latitude: 16.25, longitude: -61.52 }, frame)).toBe(true)
    expect(inBounds({ latitude: 16.3, longitude: -61.53 }, frame)).toBe(false)
    const pacific: Bounds = [170, -20, -170, 20]
    expect(inBounds({ latitude: 0, longitude: 179 }, pacific)).toBe(true)
    expect(inBounds({ latitude: 0, longitude: -175 }, pacific)).toBe(true)
    expect(inBounds({ latitude: 0, longitude: 0 }, pacific)).toBe(false)
  })
  it("treats a frame reported twice as unchanged", () => {
    expect(sameBounds(null, frame)).toBe(false)
    expect(sameBounds(frame, [...frame])).toBe(true)
    expect(sameBounds(frame, [-61.54, 16.23, -61.52, 16.26])).toBe(false)
  })
  it("lists the frame from the most recent point to the oldest", () => {
    const groups = mapGroups(all, now, { filter: "all", query: "" })
    const items = carouselGroups(groups, all, now, { bounds: frame })
    expect(items.map((item) => item.group.title)).toEqual([
      "Élan",
      "Brise",
      "Clair",
    ])
    expect(items.every((item) => item.distance === null)).toBe(true)
  })
  it("keeps every candidate while the frame is still unknown", () => {
    const groups = mapGroups(all, now, { filter: "all", query: "" })
    expect(carouselGroups(groups, all, now, { bounds: null })).toHaveLength(4)
  })
  it("sorts by distance once the spectator has located themself", () => {
    const groups = mapGroups(all, now, { filter: "all", query: "" })
    const items = carouselGroups(groups, all, now, {
      bounds: frame,
      from: { latitude: 16.236, longitude: -61.53 },
    })
    expect(items.map((item) => item.group.title)).toEqual([
      "Clair",
      "Élan",
      "Brise",
    ])
    expect(items[0]?.distance).toBeGreaterThan(0)
  })
  it("ignores an invalid spectator position instead of inventing distances", () => {
    const groups = mapGroups(all, now, { filter: "all", query: "" })
    const items = carouselGroups(groups, all, now, {
      bounds: frame,
      from: { latitude: Number.NaN, longitude: 0 },
    })
    expect(items[0]?.group.title).toBe("Élan")
    expect(items[0]?.distance).toBeNull()
  })
})

describe("walking distance", () => {
  it("measures a known distance and formats it for a pedestrian", () => {
    const meters = distanceMeters(
      { latitude: 16.24, longitude: -61.53 },
      { latitude: 16.25, longitude: -61.53 },
    )
    expect(meters).toBeGreaterThan(1100)
    expect(meters).toBeLessThan(1115)
    expect(distanceLabel(4)).toBe("10 m")
    expect(distanceLabel(347)).toBe("350 m")
    expect(distanceLabel(1_234)).toBe("1,2 km")
    expect(distanceLabel(12_600)).toBe("13 km")
  })
})

describe("group sheet main action", () => {
  it("offers directions whenever a valid point exists", () => {
    expect(groupAction(live, all, now)).toEqual({
      primary: "go",
      addition: "live",
    })
    expect(groupAction(seen, all, now)).toEqual({
      primary: "go",
      addition: "open",
    })
  })
  it("offers « Je le vois ici » without a point and without a broadcast", () => {
    expect(groupAction(none, all, now).primary).toBe("observe")
    expect(groupAction(old, all, now).primary).toBe("observe")
  })
  it("blocks additions during a broadcast, even before its first point", () => {
    const waiting = group("Muet", true, null)
    expect(groupAction(waiting, all, now)).toEqual({
      primary: "wait",
      addition: "live",
    })
  })
  it("never offers an addition the server closed", () => {
    const closed = group("Fermé", false, null, false)
    expect(groupAction(closed, all, now)).toEqual({
      primary: "none",
      addition: "closed",
    })
  })
  it("does not route to a point when the freshness policy is unknown", () => {
    expect(groupAction(seen, { ...all, policy: null }, now).primary).toBe(
      "observe",
    )
  })
})

describe("overviewPoints", () => {
  it("ignores stray points outside Guadeloupe", () => {
    const pap = { latitude: 16.24, longitude: -61.53 }
    const stray = { latitude: 10.5, longitude: -66.9 }
    expect(overviewPoints([pap, stray])).toEqual([pap])
  })
  it("keeps everything when nothing is in Guadeloupe", () => {
    const stray = { latitude: 10.5, longitude: -66.9 }
    expect(overviewPoints([stray])).toEqual([stray])
  })
})
