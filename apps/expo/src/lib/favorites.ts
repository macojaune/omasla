/**
 * « Mes groupes » : the groups a spectator stars on this phone, without an
 * account. Pure helpers only; storage lives in `use-favorites.ts`.
 */
export const FAVORITES_KEY = "omasla.favorites.v1"
const MAX_FAVORITES = 200
const MAX_ID_LENGTH = 200

export interface StoredFavorites {
  version: 1
  ids: string[]
}

const validId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length < MAX_ID_LENGTH

/** Reads the stored list; anything invalid or unknown falls back to an empty list. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("ids" in value) ||
      !Array.isArray(value.ids)
    )
      return []
    return [...new Set(value.ids.filter(validId))].slice(0, MAX_FAVORITES)
  } catch {
    return []
  }
}

export function serializeFavorites(ids: readonly string[]) {
  const value: StoredFavorites = {
    version: 1,
    ids: [...new Set(ids.filter(validId))].slice(0, MAX_FAVORITES),
  }
  return JSON.stringify(value)
}

/** Adds the group if absent, removes it otherwise. Most recent choice last. */
export function toggleFavorite(ids: readonly string[], id: string): string[] {
  if (!validId(id)) return [...ids]
  return ids.includes(id)
    ? ids.filter((value) => value !== id)
    : [...ids, id].slice(-MAX_FAVORITES)
}

/** Starred groups first, keeping the incoming order inside each block. */
export function favoritesFirst<T extends { id: string }>(
  groups: readonly T[],
  favorites: ReadonlySet<string>,
): T[] {
  return [
    ...groups.filter((group) => favorites.has(group.id)),
    ...groups.filter((group) => !favorites.has(group.id)),
  ]
}

export type DirectoryFilter = "all" | "mine" | "live"

/**
 * Groupes tab: search (accents ignored by the caller's normaliser), filter,
 * then « Mes groupes » first and alphabetical order.
 */
export function directory<T extends { id: string; title: string }>(
  groups: readonly T[],
  options: {
    query: string
    filter: DirectoryFilter
    favorites: ReadonlySet<string>
    isLive: (group: T) => boolean
    normalize: (value: string) => string
  },
): T[] {
  const query = options.normalize(options.query)
  const sorted = groups
    .filter((group) => options.normalize(group.title).includes(query))
    .filter((group) =>
      options.filter === "mine"
        ? options.favorites.has(group.id)
        : options.filter === "live"
          ? options.isLive(group)
          : true,
    )
    .sort((a, b) => a.title.localeCompare(b.title, "fr"))
  return favoritesFirst(sorted, options.favorites)
}
