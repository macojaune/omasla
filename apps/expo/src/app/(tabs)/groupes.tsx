import { useMemo, useState } from "react"
import { FlatList, StyleSheet, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import { normalizeSearch } from "~/lib/catalog-model"
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
  const [search, setSearch] = useState("")
  const data = catalog.data
  const groups = useMemo(() => {
    const query = normalizeSearch(search)
    return (data?.groups ?? [])
      .filter((group) => normalizeSearch(group.title).includes(query))
      .sort((a, b) => a.title.localeCompare(b.title, "fr"))
  }, [data, search])
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
              Groupes
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
                placeholder="Chercher un groupe"
                placeholderTextColor={c.muted}
                accessibilityLabel="Chercher un groupe"
                autoCorrect={false}
                returnKeyType="search"
                style={[s.input, { color: c.ink }]}
              />
            </View>
            {catalog.offline && (
              <Notice tone="warning">
                Hors ligne. La liste affichée est celle du dernier chargement.
              </Notice>
            )}
            {catalog.error && <Notice tone="warning">{catalog.error}</Notice>}
          </View>
        }
        ListEmptyComponent={
          !catalog.loaded ? (
            <LoadingIndicator />
          ) : (
            <Label muted>
              {search
                ? "Aucun groupe à ce nom."
                : "Aucun groupe chargé pour le moment."}
            </Label>
          )
        }
        renderItem={({ item }) =>
          data ? (
            <GroupRow
              group={item}
              catalog={data}
              now={catalog.now}
              onPress={() =>
                router.navigate({ pathname: "/", params: { groupId: item.id } })
              }
            />
          ) : null
        }
        ListFooterComponent={
          groups.length ? (
            <Label muted style={s.footer}>
              {groups.length} groupe{groups.length > 1 ? "s" : ""} référencé
              {groups.length > 1 ? "s" : ""}. Leur présence ici ne garantit pas
              une sortie ce soir.
            </Label>
          ) : undefined
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
  footer: { fontSize: 12, lineHeight: 18, paddingTop: 20 },
})
