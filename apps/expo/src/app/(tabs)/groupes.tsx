import { useMemo, useState } from "react"
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import type { DirectoryFilter } from "~/lib/favorites"
import { StarGlyph } from "~/components/favorite-star"
import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import { dataAgeLabel, isLiveNow, normalizeSearch } from "~/lib/catalog-model"
import { directory } from "~/lib/favorites"
import { useFavorites } from "~/lib/use-favorites"
import {
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  styles,
  usePalette,
} from "~/theme/ui"

export default function Groups() {
  const c = usePalette()
  const router = useRouter()
  const catalog = useCatalog()
  const favorites = useFavorites()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<DirectoryFilter>("all")
  const data = catalog.data
  const now = catalog.now
  const all = useMemo(() => data?.groups ?? [], [data])
  const groups = useMemo(
    () =>
      data
        ? directory(all, {
            query: search,
            filter,
            favorites: favorites.set,
            isLive: (group) => isLiveNow(group, data, now),
            normalize: normalizeSearch,
          })
        : [],
    [all, data, favorites.set, filter, now, search],
  )
  const mineCount = all.filter((group) => favorites.set.has(group.id)).length
  const liveCount = data
    ? all.filter((group) => isLiveNow(group, data, now)).length
    : 0
  const filters: { key: DirectoryFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "mine", label: `Mes groupes · ${mineCount}` },
    { key: "live", label: `En direct · ${liveCount}` },
  ]
  const empty = search
    ? "Aucun groupe à ce nom."
    : filter === "mine"
      ? "Touche l’étoile d’un groupe pour l’ajouter à Mes groupes. Il passera en tête des listes. Mes groupes restent sur ce téléphone, sans compte."
      : filter === "live"
        ? "Aucun groupe en direct pour le moment."
        : "Aucun groupe chargé pour le moment."
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.page, { backgroundColor: c.surface }]}
    >
      <FlatList
        data={groups}
        keyExtractor={(group) => group.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.content}
        refreshing={catalog.refreshing}
        onRefresh={catalog.offline ? undefined : catalog.refresh}
        ListHeaderComponent={
          <View style={s.header}>
            <Label accessibilityRole="header" style={styles.title}>
              Les groupes
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
                  all.length
                    ? `Chercher parmi ${all.length} groupes`
                    : "Chercher un groupe"
                }
                placeholderTextColor={c.muted}
                accessibilityLabel="Chercher un groupe"
                autoCorrect={false}
                returnKeyType="search"
                style={[s.input, { color: c.ink }]}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
              accessibilityRole="tablist"
            >
              {filters.map((item) => {
                const selected = item.key === filter
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.key)}
                    style={({ pressed }) => [
                      s.chip,
                      {
                        backgroundColor: selected ? c.ink : c.surface,
                        borderColor: selected ? c.ink : c.line,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {item.key === "mine" && (
                      <StarGlyph
                        filled
                        size={14}
                        color={selected ? c.surface : c.primary}
                      />
                    )}
                    {item.key === "live" && (
                      <View
                        style={[s.liveDot, { backgroundColor: c.success }]}
                      />
                    )}
                    <Label
                      style={[
                        s.chipText,
                        { color: selected ? c.surface : c.ink },
                      ]}
                    >
                      {item.label}
                    </Label>
                  </Pressable>
                )
              })}
            </ScrollView>
            {catalog.offline && (
              <Notice tone="warning">
                {catalog.savedAt
                  ? `Hors ligne. Liste et positions ${dataAgeLabel(catalog.savedAt, catalog.localNow)}.`
                  : "Hors ligne. Aucune liste chargée pour le moment."}
              </Notice>
            )}
            {catalog.error && <Notice tone="warning">{catalog.error}</Notice>}
          </View>
        }
        ListEmptyComponent={
          !catalog.loaded ? <LoadingIndicator /> : <Label muted>{empty}</Label>
        }
        ListFooterComponent={
          catalog.loaded && all.length > 0 ? (
            <Label muted style={s.footnote}>
              Être dans l’annuaire ne garantit pas qu’un groupe soit suivi.
            </Label>
          ) : undefined
        }
        renderItem={({ item }) =>
          data ? (
            <GroupRow
              group={item}
              catalog={data}
              now={now}
              favorite={favorites.set.has(item.id)}
              onToggleFavorite={() => favorites.toggle(item.id)}
              onPress={() =>
                router.navigate({ pathname: "/", params: { groupId: item.id } })
              }
            />
          ) : null
        }
      />
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  header: { gap: 14, paddingBottom: 8 },
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
  filters: { gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  footnote: { fontSize: 13, lineHeight: 19, paddingTop: 16 },
})
