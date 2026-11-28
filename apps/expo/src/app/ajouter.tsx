import { useMemo, useState } from "react"
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import GroupEmblem from "~/components/group-emblem"
import ScreenHeader from "~/components/screen-header"
import { useCatalog } from "~/lib/catalog"
import { normalizeSearch } from "~/lib/catalog-model"
import { Icon, Label, LoadingIndicator, Notice, usePalette } from "~/theme/ui"

/** Step 1 of « + » : which group do you see? Step 2 is the existing confirmation screen. */
export default function AddPosition() {
  const c = usePalette()
  const router = useRouter()
  const catalog = useCatalog()
  const [search, setSearch] = useState("")
  const groups = useMemo(() => {
    const query = normalizeSearch(search)
    return (catalog.data?.groups ?? [])
      .filter((group) => normalizeSearch(group.title).includes(query))
      .sort(
        (a, b) =>
          Number(a.live) - Number(b.live) ||
          a.title.localeCompare(b.title, "fr"),
      )
  }, [catalog.data, search])
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
        data={groups}
        keyExtractor={(group) => group.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={s.header}>
            <Label accessibilityRole="header" style={s.title}>
              Quel groupe vois-tu ?
            </Label>
            <Label muted style={s.caption}>
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
        renderItem={({ item }) => {
          const unavailable = item.live || !item.canObserve
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unavailable
                  ? `${item.title}. En direct : un membre du groupe partage déjà sa position.`
                  : `${item.title}. Choisir ce groupe`
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
                <Label style={s.name} numberOfLines={2}>
                  {item.title.replace(/ · démo$/, "")}
                </Label>
                {unavailable && (
                  <Label muted style={s.caption}>
                    {item.live
                      ? "En direct : un membre du groupe le suit déjà"
                      : "Ajout indisponible pour ce groupe"}
                  </Label>
                )}
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
  name: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
})
