import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import type { PublicGroup } from "@omasla/convex"

import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import { tonightSections } from "~/lib/catalog-model"
import { daysUntil, nextOuting, outingLabels } from "~/lib/season"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  styles,
  usePalette,
} from "~/theme/ui"

export default function Tonight() {
  const c = usePalette()
  const router = useRouter()
  const catalog = useCatalog()
  const [showWaiting, setShowWaiting] = useState(false)
  const data = catalog.data
  const sections = useMemo(
    () => (data ? tonightSections(data, catalog.now) : null),
    [data, catalog.now],
  )
  const outing = nextOuting(new Date(catalog.now))
  const days = daysUntil(new Date(catalog.now), outing.date)
  const active = Boolean(
    sections && sections.live.length + sections.seen.length,
  )
  const open = (group: PublicGroup) =>
    router.navigate({ pathname: "/", params: { groupId: group.id } })
  const list = (groups: PublicGroup[]) =>
    data
      ? groups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            catalog={data}
            now={catalog.now}
            onPress={() => open(group)}
          />
        ))
      : null
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.page, { backgroundColor: c.surface }]}
    >
      <ScrollView contentContainerStyle={[styles.content, s.content]}>
        <Label accessibilityRole="header" style={styles.title}>
          Ce soir
        </Label>
        {catalog.offline && (
          <Notice tone="warning">
            Hors ligne. Les positions affichées sont datées.
          </Notice>
        )}
        {!catalog.loaded ? (
          <LoadingIndicator />
        ) : !active ? (
          <View style={[s.countdown, { backgroundColor: c.primarySoft }]}>
            <Label style={[s.overline, { color: c.primary }]}>
              {days === 0
                ? "Sortie aujourd’hui"
                : `Prochaine sortie · J-${days}`}
            </Label>
            <Label style={s.date}>
              {outingLabels[outing.kind]}{" "}
              {outing.date.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Label>
            <Label muted style={s.caption}>
              {days === 0
                ? "Aucun groupe n’est encore repéré. Les positions apparaîtront ici dès les premières sorties."
                : "Les groupes sortent le dimanche soir, du premier dimanche de janvier jusqu’au mercredi des Cendres."}
            </Label>
          </View>
        ) : null}
        {sections && active && (
          <>
            {sections.live.length > 0 && (
              <View style={s.section}>
                <Label accessibilityRole="header" style={s.sectionTitle}>
                  En direct · {sections.live.length}
                </Label>
                {list(sections.live)}
              </View>
            )}
            {sections.seen.length > 0 && (
              <View style={s.section}>
                <Label accessibilityRole="header" style={s.sectionTitle}>
                  Vus récemment · {sections.seen.length}
                </Label>
                {list(sections.seen)}
              </View>
            )}
          </>
        )}
        {sections && sections.waiting.length > 0 && active && (
          <View style={s.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showWaiting }}
              onPress={() => setShowWaiting((value) => !value)}
              style={s.toggle}
            >
              <Label style={[s.sectionTitle, { flex: 1 }]}>
                Pas encore repérés · {sections.waiting.length}
              </Label>
              <Icon
                name={showWaiting ? "expand" : "down"}
                color={c.muted}
                size={18}
              />
            </Pressable>
            {showWaiting && list(sections.waiting)}
          </View>
        )}
        {catalog.loaded && !active && (
          <View style={s.section}>
            <Label accessibilityRole="header" style={s.sectionTitle}>
              En attendant
            </Label>
            <Button
              title="Parcourir les groupes"
              icon="groups"
              variant="secondary"
              onPress={() => router.navigate("/groupes")}
            />
            <Button
              title="Préparer ma diffusion"
              icon="signal"
              variant="secondary"
              onPress={() => router.navigate("/moi")}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 32 },
  countdown: { borderRadius: 20, padding: 20, gap: 6 },
  overline: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  date: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  caption: { fontSize: 14, lineHeight: 21 },
  section: { gap: 4 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  toggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
})
