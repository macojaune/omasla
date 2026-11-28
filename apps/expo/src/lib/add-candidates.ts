import type { PublicCatalog, PublicGroup } from "@omasla/convex"

import { visiblePosition } from "./catalog-model"

export interface Coordinate {
  latitude: number
  longitude: number
}

/** Groups whose last point is within this distance count as « proches de toi ». */
export const NEARBY_RADIUS_METERS = 2_000

/** Great-circle distance (haversine), in metres. */
export function distanceMeters(a: Coordinate, b: Coordinate) {
  const radius = 6_371_000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(meters: number) {
  if (meters < 1_000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1_000).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })} km`
}

export interface AddCandidate {
  group: PublicGroup
  /** Distance to the group's last visible point, when the user's position is known. */
  distance: number | null
  nearby: boolean
}

/**
 * « Quel groupe vois-tu ? » order:
 * 1. groups whose visible last point is near the user, closest first;
 * 2. « Mes groupes »;
 * 3. everyone else, alphabetical.
 * Live groups keep their place; the screen greys them out with the reason.
 * Without a known user position, only steps 2 and 3 apply.
 */
export function orderAddCandidates(
  catalog: PublicCatalog,
  now: number,
  options: {
    user: Coordinate | null
    favorites: ReadonlySet<string>
    radius?: number
  },
): AddCandidate[] {
  const radius = options.radius ?? NEARBY_RADIUS_METERS
  const candidates = [...catalog.groups]
    .sort((a, b) => a.title.localeCompare(b.title, "fr"))
    .map((group): AddCandidate => {
      const point = visiblePosition(group, catalog, now)
      const distance =
        options.user && point ? distanceMeters(options.user, point) : null
      return {
        group,
        distance,
        nearby: distance !== null && distance <= radius,
      }
    })
  const nearby = candidates
    .filter((candidate) => candidate.nearby)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  const rest = candidates.filter((candidate) => !candidate.nearby)
  const starred = (candidate: AddCandidate) =>
    options.favorites.has(candidate.group.id)
  return [
    ...nearby,
    ...rest.filter(starred),
    ...rest.filter((candidate) => !starred(candidate)),
  ]
}
