import type { PublicCatalog, PublicGroup, PublicPosition } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import { normalizeSearch, visiblePosition } from "./catalog-model"

/** MapLibre visible region: [west, south, east, north] in degrees. */
export type Bounds = [west: number, south: number, east: number, north: number]
export interface Coordinate {
  latitude: number
  longitude: number
}
/** « En direct » and « Vus récemment » chips; `all` shows every spotted group. */
export type MapFilter = "all" | "live" | "seen"
/** Same classification as « Ce soir »: live first, then recently seen, then not spotted. */
export type SpotState = "live" | "seen" | "unseen"

export function spotState(
  group: PublicGroup,
  catalog: PublicCatalog,
  now: number,
): SpotState {
  const freshness = positionFreshness(group.position, catalog.policy, now)
  if (
    group.live &&
    group.position?.source === "referent" &&
    freshness === "recent"
  )
    return "live"
  return visiblePosition(group, catalog, now) ? "seen" : "unseen"
}

export function spotCounts(catalog: PublicCatalog, now: number) {
  let live = 0
  let seen = 0
  for (const group of catalog.groups) {
    const state = spotState(group, catalog, now)
    if (state === "live") live++
    else if (state === "seen") seen++
  }
  return { live, seen, spotted: live + seen }
}

export function matchesSearch(
  group: Pick<PublicGroup, "title">,
  query: string,
) {
  return normalizeSearch(group.title).includes(normalizeSearch(query))
}

/** Groups drawn on the map: a valid point, the active chip and the search. */
export function mapGroups(
  catalog: PublicCatalog,
  now: number,
  { filter, query }: { filter: MapFilter; query: string },
) {
  return catalog.groups.filter((group) => {
    const state = spotState(group, catalog, now)
    if (state === "unseen") return false
    if (filter !== "all" && state !== filter) return false
    return matchesSearch(group, query)
  })
}

/** Search results include groups without a point: their sheet offers « Je le vois ici ». */
export function searchGroups(
  catalog: PublicCatalog,
  now: number,
  query: string,
) {
  if (!normalizeSearch(query)) return []
  const rank: Record<SpotState, number> = { live: 0, seen: 1, unseen: 2 }
  return catalog.groups
    .filter((group) => matchesSearch(group, query))
    .map((group) => ({ group, state: spotState(group, catalog, now) }))
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        a.group.title.localeCompare(b.group.title, "fr"),
    )
    .map(({ group }) => group)
}

function validCoordinate(value: Coordinate | null | undefined) {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Math.abs(value.latitude) <= 90 &&
      Number.isFinite(value.longitude) &&
      Math.abs(value.longitude) <= 180,
  )
}

/** Inclusive; a region crossing the antimeridian has west > east. */
export function inBounds(point: Coordinate, bounds: Bounds) {
  const [west, south, east, north] = bounds
  if (point.latitude < south || point.latitude > north) return false
  return west <= east
    ? point.longitude >= west && point.longitude <= east
    : point.longitude >= west || point.longitude <= east
}

/** Avoids re-sorting the carousel when the map reports the same frame again. */
export function sameBounds(a: Bounds | null, b: Bounds) {
  return Boolean(
    a?.every((value, index) => Math.abs(value - (b[index] ?? NaN)) < 1e-7),
  )
}

/** Great-circle distance (haversine), in metres. */
export function distanceMeters(from: Coordinate, to: Coordinate) {
  const radius = 6_371_000
  const rad = Math.PI / 180
  const dLat = (to.latitude - from.latitude) * rad
  const dLon = (to.longitude - from.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * rad) *
      Math.cos(to.latitude * rad) *
      Math.sin(dLon / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Walking scale: 10 m steps under 1 km, then one decimal up to 10 km. */
export function distanceLabel(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  if (meters < 9950)
    return `${(Math.round(meters / 100) / 10).toLocaleString("fr-FR")} km`
  return `${Math.round(meters / 1000)} km`
}

export function pointTime(position: PublicPosition) {
  return position.observedAt ?? position.receivedAt
}

export interface CarouselItem {
  group: PublicGroup
  position: PublicPosition
  state: Exclude<SpotState, "unseen">
  distance: number | null
}

/**
 * Carousel under the map: groups whose point is inside the current frame,
 * nearest first once the spectator has located themself, otherwise the most
 * recent point first. Without a known frame yet, every candidate is kept.
 */
export function carouselGroups(
  groups: PublicGroup[],
  catalog: PublicCatalog,
  now: number,
  {
    bounds,
    from,
  }: { bounds: Bounds | null; from?: Coordinate | null | undefined },
): CarouselItem[] {
  const origin = validCoordinate(from) ? from : null
  const items: CarouselItem[] = []
  for (const group of groups) {
    const position = visiblePosition(group, catalog, now)
    if (!position) continue
    if (bounds && !inBounds(position, bounds)) continue
    const state = spotState(group, catalog, now)
    if (state === "unseen") continue
    items.push({
      group,
      position,
      state,
      distance: origin ? distanceMeters(origin, position) : null,
    })
  }
  return items.sort((a, b) =>
    a.distance !== null && b.distance !== null
      ? a.distance - b.distance ||
        a.group.title.localeCompare(b.group.title, "fr")
      : pointTime(b.position) - pointTime(a.position) ||
        a.group.title.localeCompare(b.group.title, "fr"),
  )
}

/**
 * Group sheet (P1): the main action follows the state of the group.
 * - `go`: a valid point exists, walking directions to it;
 * - `observe`: no valid point and no live broadcast, « Je le vois ici »;
 * - `wait`: live but no point yet, nothing to do but wait;
 * - `none`: no point and public additions are closed for this group.
 * `addition` tells whether « Je le vois ici » is offered at all, and why not.
 */
export function groupAction(
  group: PublicGroup,
  catalog: PublicCatalog,
  now: number,
): {
  primary: "go" | "observe" | "wait" | "none"
  addition: "open" | "live" | "closed"
} {
  const addition = group.live ? "live" : group.canObserve ? "open" : "closed"
  const primary = visiblePosition(group, catalog, now)
    ? "go"
    : group.live
      ? "wait"
      : addition === "open"
        ? "observe"
        : "none"
  return { primary, addition }
}
