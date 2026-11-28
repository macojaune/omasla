import { describe, expect, it } from "vitest"

import type { Id, PublicCatalog, PublicGroup } from "@omasla/convex"

import {
  distanceMeters,
  formatDistance,
  orderAddCandidates,
} from "./add-candidates"

// Fictional positions and groups exclusively for testing.
const now = 1_700_000_000_000
const user = { latitude: 16.2411, longitude: -61.5331 }
const point = (
  latitude: number,
  longitude: number,
  age = 30_000,
): PublicGroup["position"] => ({
  id: `p-${latitude}-${longitude}` as Id<"positions">,
  latitude,
  longitude,
  source: "community",
  observedAt: now - age,
  receivedAt: now - age,
  timestampBasis: "observed",
})
const group = (
  title: string,
  position: PublicGroup["position"],
  live = false,
): PublicGroup => ({
  id: title as Id<"groups">,
  title,
  live,
  canObserve: !live,
  position: position && live ? { ...position, source: "referent" } : position,
})
const catalog: PublicCatalog = {
  serverNow: now,
  policy: { freshForMs: 60_000, hideAfterMs: 180_000 },
  groups: [
    group("Zanmi", null),
    group("Loin", point(16.33, -61.53)),
    group("Proche", point(16.2421, -61.5331)),
    group("Très proche", point(16.2412, -61.5331)),
    group("Ancien", point(16.2411, -61.5331, 600_000)),
    group("Direct", point(16.2416, -61.5331), true),
    group("Alizé", null),
  ],
}
const titles = (value: ReturnType<typeof orderAddCandidates>) =>
  value.map((candidate) => candidate.group.title)

describe("distanceMeters", () => {
  it("measures short distances", () => {
    const d = distanceMeters(user, { latitude: 16.2421, longitude: -61.5331 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(118)
  })
})

describe("formatDistance", () => {
  it("rounds metres and uses a French decimal for kilometres", () => {
    expect(formatDistance(4)).toBe("10 m")
    expect(formatDistance(118)).toBe("120 m")
    expect(formatDistance(1_240)).toBe("1,2 km")
  })
})

describe("orderAddCandidates", () => {
  it("puts nearby points first, closest first, live groups kept in place", () => {
    const order = orderAddCandidates(catalog, now, {
      user,
      favorites: new Set(["Zanmi"]),
    })
    expect(titles(order)).toEqual([
      "Très proche",
      "Direct",
      "Proche",
      "Zanmi",
      "Alizé",
      "Ancien",
      "Loin",
    ])
    expect(order[0]?.nearby).toBe(true)
    expect(order.find((c) => c.group.title === "Loin")?.nearby).toBe(false)
    expect(order.find((c) => c.group.title === "Ancien")?.distance).toBeNull()
  })
  it("falls back to « Mes groupes » then alphabetical without a position", () => {
    const order = orderAddCandidates(catalog, now, {
      user: null,
      favorites: new Set(["Proche", "Loin"]),
    })
    expect(titles(order)).toEqual([
      "Loin",
      "Proche",
      "Alizé",
      "Ancien",
      "Direct",
      "Très proche",
      "Zanmi",
    ])
    expect(order.every((c) => c.distance === null)).toBe(true)
  })
})
