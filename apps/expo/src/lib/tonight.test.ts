import { describe, expect, it } from "vitest"

import type { Id, PublicCatalog, PublicGroup } from "@omasla/convex"

import { tonightSections } from "./catalog-model"

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
})
