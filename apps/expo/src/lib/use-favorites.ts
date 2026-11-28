import { useCallback, useMemo, useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  FAVORITES_KEY,
  parseFavorites,
  serializeFavorites,
  toggleFavorite,
} from "./favorites"

/**
 * One shared in-memory copy for every tab, persisted on this phone only.
 * « Mes groupes » works without an account; account sync is not decided yet.
 */
let ids: string[] = []
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function load() {
  loading ??= AsyncStorage.getItem(FAVORITES_KEY)
    .then((raw) => {
      ids = parseFavorites(raw)
    })
    .catch(() => {
      /* Storage unavailable: start from an empty list. */
    })
    .finally(emit)
  return loading
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  void load()
  return () => listeners.delete(listener)
}
const snapshot = () => ids

function write(next: string[]) {
  ids = next
  emit()
  void AsyncStorage.setItem(FAVORITES_KEY, serializeFavorites(next)).catch(
    () => {
      /* The choice stays for this session even if it cannot be saved. */
    },
  )
}

export function useFavorites() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)
  const set = useMemo(() => new Set(current), [current])
  // Wait for the stored list so an early tap never overwrites it.
  const toggle = useCallback(
    (id: string) => void load().then(() => write(toggleFavorite(ids, id))),
    [],
  )
  return { ids: current, set, toggle }
}
