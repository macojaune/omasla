import { describe, expect, it } from "vitest"

import { normalizeSearch } from "./catalog-model"
import {
  directory,
  favoritesFirst,
  parseFavorites,
  serializeFavorites,
  toggleFavorite,
} from "./favorites"

// Fictional groups exclusively for testing.
const groups = [
  { id: "z", title: "Zouk Mas", live: false },
  { id: "e", title: "Écho Mas", live: true },
  { id: "a", title: "Akata", live: false },
  { id: "k", title: "Kalbas", live: true },
]

describe("favorites storage", () => {
  it("round-trips and drops duplicates or invalid ids", () => {
    const raw = serializeFavorites(["a", "a", "", "k"])
    expect(parseFavorites(raw)).toEqual(["a", "k"])
  })
  it("ignores missing, corrupt or unknown payloads", () => {
    expect(parseFavorites(null)).toEqual([])
    expect(parseFavorites("{oops")).toEqual([])
    expect(parseFavorites(JSON.stringify(["a"]))).toEqual([])
    expect(parseFavorites(JSON.stringify({ version: 2, ids: ["a"] }))).toEqual(
      [],
    )
    expect(
      parseFavorites(JSON.stringify({ version: 1, ids: ["a", 3, null] })),
    ).toEqual(["a"])
  })
  it("toggles a group in and out", () => {
    expect(toggleFavorite([], "a")).toEqual(["a"])
    expect(toggleFavorite(["a", "k"], "a")).toEqual(["k"])
    expect(toggleFavorite(["a"], "")).toEqual(["a"])
  })
})

describe("favoritesFirst", () => {
  it("moves starred groups first and keeps the order otherwise", () => {
    expect(
      favoritesFirst(groups, new Set(["k", "z"])).map((g) => g.id),
    ).toEqual(["z", "k", "e", "a"])
  })
})

describe("directory", () => {
  const base = {
    query: "",
    favorites: new Set(["k"]),
    isLive: (group: (typeof groups)[number]) => group.live,
    normalize: normalizeSearch,
  }
  it("lists everyone, « Mes groupes » first then alphabetical", () => {
    expect(
      directory(groups, { ...base, filter: "all" }).map((g) => g.id),
    ).toEqual(["k", "a", "e", "z"])
  })
  it("filters « Mes groupes » and « En direct »", () => {
    expect(
      directory(groups, { ...base, filter: "mine" }).map((g) => g.id),
    ).toEqual(["k"])
    expect(
      directory(groups, { ...base, filter: "live" }).map((g) => g.id),
    ).toEqual(["k", "e"])
  })
  it("searches without accents or case", () => {
    expect(
      directory(groups, { ...base, filter: "all", query: "ECHO" }).map(
        (g) => g.id,
      ),
    ).toEqual(["e"])
    expect(
      directory(groups, { ...base, filter: "all", query: " écho " }).map(
        (g) => g.id,
      ),
    ).toEqual(["e"])
  })
})
