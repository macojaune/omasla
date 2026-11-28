import { useEffect, useMemo, useState } from "react"
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Location from "expo-location"
import { useRouter } from "expo-router"

import type { Coordinate } from "~/lib/add-candidates"
import { StarGlyph } from "~/components/favorite-star"
import GroupEmblem from "~/components/group-emblem"
import ScreenHeader from "~/components/screen-header"
import { formatDistance, orderAddCandidates } from "~/lib/add-candidates"
import { useCatalog } from "~/lib/catalog"
import { ageLabel, normalizeSearch, visiblePosition } from "~/lib/catalog-model"
import { useFavorites } from "~/lib/use-favorites"
import { Icon, Label, LoadingIndicator, Notice, usePalette } from "~/theme/ui"

/**
 * The user's position, only if location is already allowed: opening « + »
 * never shows a permission prompt (that stays tied to publishing). Used on
 * this phone to sort groups; never sent.
 */
function useKnownPosition() {
  const [position, setPosition] = useState<Coordinate | null>(null)
  useEffect(() => {
    let alive = true
    const locate = async () => {
      const permission = await Location.getForegroundPermissionsAsync()
      if (!permission.granted) return
      const fix =
        (await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60_000,
          requiredAccuracy: 500,
        })) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }))
      if (alive)
        setPosition({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        })
    }
    void locate().catch(() => {
      /* Without a position, the list keeps « Mes groupes » then alphabetical order. */
    })
    return () => {
      alive = false
    }
  }, [])
  return position
}

/** Step 1 of « + » : which group do you see? Step 2 is the existing confirmation screen. */
export default function AddPosition() {
  const c = usePalette()
  const router = useRouter()
  const catalog = useCatalog()
  const favorites = useFavorites()
  const user = useKnownPosition()
  const [search, setSearch] = useState("")
  const data = catalog.data
  const now = catalog.now
  const candidates = useMemo(() => {
    if (!data) return []
    const query = normalizeSearch(search)
    return orderAddCandidates(data, now, {
      user,
      favorites: favorites.set,
    }).filter((candidate) =>
      normalizeSearch(candidate.group.title).includes(query),
    )
  }, [data, now, user, favorites.set, search])
  const sortedByDistance = candidates.some((candidate) => candidate.nearby)
  return (
    <SafeAreaView
      edges={
        Platform.OS === "ios"
          ? ["left", "right", "bottom"]
          : ["top", "left", "right", "bottom"]
      }
      style={[s.page, { backgroundColor: c.surface }]}
    >
      <ScreenHeader title="Ajouter une position" />
      <FlatList
        data={candidates}
        keyExtractor={(candidate) => candidate.group.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={s.header}>
            <Label accessibilityRole="header" style={s.title}>
              Quel groupe vois-tu ?
            </Label>
            <Label muted style={s.caption}>
              {sortedByDistance ? "Les plus proches de toi d’abord. " : ""}
              Ta position actuelle sera publiée avec l’heure, jamais ton nom.
            </Label>
            <View
              style={[
                s.search,
                { backgroundColor: c.background, borderColor: c.line },
              ]}
            >
              <Icon name="search" color={c.muted} size={20} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  sortedByDistance ? "Un autre groupe…" : "Chercher un groupe"
                }
                placeholderTextColor={c.muted}
                accessibilityLabel="Chercher un groupe"
                autoCorrect={false}
                returnKeyType="search"
                style={[s.input, { color: c.ink }]}
              />
            </View>
            {catalog.offline && (
              <Notice tone="warning">
                Tu es hors ligne. Reconnecte-toi pour ajouter une position.
              </Notice>
            )}
          </View>
        }
        ListEmptyComponent={
          !catalog.loaded ? (
            <LoadingIndicator />
          ) : (
            <Label muted>Aucun groupe à ce nom.</Label>
          )
        }
        renderItem={({ item: candidate }) => {
          const item = candidate.group
          const unavailable = item.live || !item.canObserve
          const point = data ? visiblePosition(item, data, now) : null
          const favorite = favorites.set.has(item.id)
          const detail = item.live
            ? "En direct, suivi par un membre du groupe"
            : !item.canObserve
              ? "Ajout indisponible pour ce groupe"
              : point
                ? `Dernier point ${ageLabel(point, now)}${
                    candidate.distance !== null
                      ? ` · ${formatDistance(candidate.distance)}`
                      : ""
                  }`
                : "Pas de position récente"
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unavailable
                  ? `${item.title}. ${detail}.${item.live ? " Ajout indisponible." : ""}`
                  : `${item.title}${favorite ? ", dans Mes groupes" : ""}. ${detail}. Choisir ce groupe`
              }
              accessibilityState={{ disabled: unavailable }}
              disabled={unavailable}
              onPress={() =>
                router.replace({
                  pathname: "/observe",
                  params: { groupId: item.id },
                })
              }
              style={({ pressed }) => [
                s.row,
                {
                  borderBottomColor: c.line,
                  opacity: unavailable ? 0.5 : pressed ? 0.6 : 1,
                },
              ]}
            >
              <GroupEmblem group={item} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.nameRow}>
                  <Label style={s.name} numberOfLines={2}>
                    {item.title.replace(/ · démo$/, "")}
                  </Label>
                  {favorite && <StarGlyph filled size={14} />}
                </View>
                <Label muted style={s.caption}>
                  {detail}
                </Label>
              </View>
              {!unavailable && (
                <Icon name="chevron" color={c.muted} size={18} />
              )}
            </Pressable>
          )
        }}
      />
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  header: { gap: 12, paddingTop: 8, paddingBottom: 12 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  caption: { fontSize: 14, lineHeight: 20 },
  search: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 17, lineHeight: 23, fontWeight: "600", flexShrink: 1 },
})
