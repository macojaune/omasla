import { describe, expect, it } from "vitest"

import { daysUntil, easter, nextOuting, opensSeason, season } from "./season"

const ymd = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`

describe("season", () => {
  it("computes Easter", () => {
    expect(ymd(easter(2026))).toBe("2026-04-05")
    expect(ymd(easter(2027))).toBe("2027-03-28")
  })
  it("starts on the first Sunday of January and ends on Ash Wednesday", () => {
    const s = season(2027)
    expect(ymd(s.start)).toBe("2027-01-03")
    expect(ymd(s.end)).toBe("2027-02-10")
  })
  it("points to the first outing of 2027 from late November 2026", () => {
    const now = new Date(2026, 10, 28, 15)
    const outing = nextOuting(now)
    expect(ymd(outing.date)).toBe("2027-01-03")
    expect(outing.kind).toBe("dimanche")
    expect(daysUntil(now, outing.date)).toBe(36)
  })
  it("returns today on a Sunday in season", () => {
    expect(ymd(nextOuting(new Date(2027, 0, 17, 20)).date)).toBe("2027-01-17")
  })
  it("includes the jours gras", () => {
    expect(nextOuting(new Date(2027, 1, 8, 9)).kind).toBe("lundi-gras")
    expect(nextOuting(new Date(2027, 1, 9, 9)).kind).toBe("mardi-gras")
    expect(nextOuting(new Date(2027, 1, 10, 9)).kind).toBe("cendres")
  })
  it("jumps to next January after Ash Wednesday", () => {
    expect(ymd(nextOuting(new Date(2027, 1, 11)).date)).toBe("2028-01-02")
  })
  it("recognises the season opening", () => {
    expect(opensSeason(nextOuting(new Date(2026, 10, 28)))).toBe(true)
    expect(opensSeason(nextOuting(new Date(2027, 0, 11)))).toBe(false)
  })
})
