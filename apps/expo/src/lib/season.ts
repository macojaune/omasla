/**
 * Carnival calendar in Guadeloupe: groups go out on Sunday evenings from the
 * first Sunday of January, then on the « jours gras » (Lundi gras, Mardi gras)
 * and Ash Wednesday, which closes the season. Dates are local calendar days.
 */
export interface Outing {
  date: Date
  kind: "dimanche" | "lundi-gras" | "mardi-gras" | "cendres"
}

function day(year: number, month: number, date: number) {
  return new Date(year, month, date)
}
function addDays(value: Date, days: number) {
  return day(value.getFullYear(), value.getMonth(), value.getDate() + days)
}
/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easter(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const date = ((h + l - 7 * m + 114) % 31) + 1
  return day(year, month, date)
}
export function season(year: number) {
  const january = day(year, 0, 1)
  const start = addDays(january, (7 - january.getDay()) % 7)
  const ashWednesday = addDays(easter(year), -46)
  return { start, end: ashWednesday }
}
function outingOn(value: Date): Outing | null {
  const { start, end } = season(value.getFullYear())
  if (value < start || value > end) return null
  const untilEnd = Math.round((end.getTime() - value.getTime()) / 86_400_000)
  if (untilEnd === 0) return { date: value, kind: "cendres" }
  if (untilEnd === 1) return { date: value, kind: "mardi-gras" }
  if (untilEnd === 2) return { date: value, kind: "lundi-gras" }
  if (value.getDay() === 0) return { date: value, kind: "dimanche" }
  return null
}
/** Today if it is an outing day, otherwise the next one. */
export function nextOuting(now: Date): Outing {
  let cursor = day(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < 400; i++) {
    const outing = outingOn(cursor)
    if (outing) return outing
    cursor = addDays(cursor, 1)
  }
  throw new Error("No outing found within a year")
}
export function daysUntil(now: Date, target: Date) {
  const today = day(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
export const outingLabels: Record<Outing["kind"], string> = {
  dimanche: "Dimanche",
  "lundi-gras": "Lundi gras",
  "mardi-gras": "Mardi gras",
  cendres: "Mercredi des Cendres",
}
