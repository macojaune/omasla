import { describe, expect, it } from "vitest"

import type { Id, PublicCatalog, PublicGroup } from "@omasla/convex"

import { dataAgeLabel, isLiveNow, tonightSections } from "./catalog-model"

// Fictional data exclusively for testing.
const now = 1_700_000_000_000
const position = (
  source: "referent" | "community",
  age: number,
): PublicGroup["position"] => ({
  id: `p-${source}-${age}` as Id<"positions">,
  latitude: 16.24,
  longitude: -61.53,
  source,
  observedAt: now - age,
  receivedAt: now - age,
  timestampBasis: "observed",
})
const group = (
  title: string,
  live: boolean,
  value: PublicGroup["position"],
): PublicGroup => ({
  id: title as Id<"groups">,
  title,
  live,
  canObserve: !live,
  position: value,
})
const catalog: PublicCatalog = {
  serverNow: now,
  policy: { freshForMs: 60_000, hideAfterMs: 180_000 },
  groups: [
    group("Zeta", false, null),
    group("Bêta", true, position("referent", 10_000)),
    group("Alpha", false, position("community", 90_000)),
    group("Gamma", false, position("community", 500_000)),
    group("Delta", true, null),
  ],
}

describe("tonightSections", () => {
  it("splits live, recently seen and waiting groups", () => {
    const sections = tonightSections(catalog, now)
    expect(sections.live.map((g) => g.title)).toEqual(["Bêta"])
    expect(sections.seen.map((g) => g.title)).toEqual(["Alpha"])
    expect(sections.waiting.map((g) => g.title)).toEqual([
      "Delta",
      "Gamma",
      "Zeta",
    ])
  })
  it("puts « Mes groupes » first inside each section", () => {
    const sections = tonightSections(catalog, now, new Set(["Zeta"]))
    expect(sections.waiting.map((g) => g.title)).toEqual([
      "Zeta",
      "Delta",
      "Gamma",
    ])
    expect(sections.live.map((g) => g.title)).toEqual(["Bêta"])
  })
  it("only counts a fresh point from a member as live", () => {
    const live = catalog.groups.filter((g) => isLiveNow(g, catalog, now))
    expect(live.map((g) => g.title)).toEqual(["Bêta"])
  })
})

describe("dataAgeLabel", () => {
  it("says how old the loaded data is", () => {
    expect(dataAgeLabel(now, now + 20_000)).toBe(
      "chargées il y a moins d’une minute",
    )
    expect(dataAgeLabel(now, now + 12 * 60_000)).toBe("chargées il y a 12 min")
    expect(dataAgeLabel(now, now + 3 * 3_600_000)).toBe("chargées il y a 3 h")
    expect(dataAgeLabel(now, now + 50 * 3_600_000)).toBe(
      "chargées il y a 2 jours",
    )
    expect(dataAgeLabel(now, now - 5_000)).toBe(
      "chargées il y a moins d’une minute",
    )
  })
})
