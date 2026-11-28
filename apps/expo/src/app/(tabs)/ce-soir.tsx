import type { Href } from "expo-router"
import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import type { PublicGroup } from "@omasla/convex"

import type { IconName } from "~/theme/ui"
import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import { dataAgeLabel, tonightSections } from "~/lib/catalog-model"
import { daysUntil, nextOuting, opensSeason, outingLabels } from "~/lib/season"
import { useFavorites } from "~/lib/use-favorites"
import {
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  styles,
  usePalette,
} from "~/theme/ui"

const longDate = (value: Date) =>
  value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

export default function Tonight() {
  const c = usePalette()
  const router = useRouter()
  const catalog = useCatalog()
  const favorites = useFavorites()
  const [showWaiting, setShowWaiting] = useState(false)
  const data = catalog.data
  const sections = useMemo(
    () => (data ? tonightSections(data, catalog.now, favorites.set) : null),
    [data, catalog.now, favorites.set],
  )
  const today = new Date(catalog.now)
  const outing = nextOuting(today)
  const days = daysUntil(today, outing.date)
  const spotted = sections ? sections.live.length + sections.seen.length : 0
  const active = spotted > 0
  const mineCount = data
    ? data.groups.filter((group) => favorites.set.has(group.id)).length
    : 0
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
            favorite={favorites.set.has(group.id)}
            onPress={() => open(group)}
          />
        ))
      : null
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.page, { backgroundColor: c.background }]}
    >
      <ScrollView contentContainerStyle={[styles.content, s.content]}>
        <View style={s.heading}>
          <Label style={[s.overline, { color: c.muted }]}>
            {longDate(today)}
          </Label>
          <Label accessibilityRole="header" style={s.title}>
            {active ? (
              <>
                Ce soir,{" "}
                <Label style={[s.title, { color: c.primary }]}>
                  {spotted} {spotted > 1 ? "groupes" : "groupe"}
                </Label>{" "}
                {spotted > 1 ? "repérés" : "repéré"}
              </>
            ) : days === 0 ? (
              "Sortie ce soir."
            ) : (
              "Pas de sortie ce soir."
            )}
          </Label>
        </View>
        {catalog.offline && (
          <Notice tone="warning">
            {catalog.savedAt
              ? `Hors ligne. Données ${dataAgeLabel(catalog.savedAt, catalog.localNow)} : les groupes ont pu bouger depuis.`
              : "Hors ligne. Aucune donnée chargée pour le moment."}
          </Notice>
        )}
        {catalog.error && !catalog.offline && (
          <Notice tone="warning">{catalog.error}</Notice>
        )}
        {!catalog.loaded ? (
          <LoadingIndicator />
        ) : !active ? (
          <View style={[s.countdown, { backgroundColor: c.primary }]}>
            <Label style={[s.cardOverline, { color: c.primaryText }]}>
              {opensSeason(outing)
                ? `Première sortie de la saison ${outing.date.getFullYear()}`
                : "Prochaine sortie"}
            </Label>
            <Label
              accessibilityLabel={
                days === 0
                  ? "Ce soir"
                  : `Dans ${days} jour${days > 1 ? "s" : ""}`
              }
              style={[s.days, { color: c.primaryText }]}
            >
              {days === 0 ? "Ce soir" : `J-${days}`}
            </Label>
            <Label style={[s.cardDate, { color: c.primaryText }]}>
              {outingLabels[outing.kind]}{" "}
              {outing.date.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Label>
            <Label style={[s.caption, { color: c.primaryText, opacity: 0.85 }]}>
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
            {sections.waiting.length > 0 && (
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
          </>
        )}
        {catalog.loaded && !active && (
          <View style={s.section}>
            <Label accessibilityRole="header" style={s.sectionTitle}>
              En attendant
            </Label>
            <Shortcut
              icon="groups"
              title="Choisis tes groupes"
              caption={
                mineCount > 0
                  ? `${mineCount} dans Mes groupes. Tu les retrouveras en tête le soir venu.`
                  : "Tu les retrouveras en tête le soir venu."
              }
              href="/groupes"
            />
            <Shortcut
              icon="signal"
              title="Tu es membre d’un groupe ?"
              caption="Prépare ta diffusion avant la sortie."
              href="/moi"
            />
          </View>
        )}
        {catalog.loaded && <PartnerSlot />}
      </ScrollView>
    </SafeAreaView>
  )
}

function Shortcut({
  icon,
  title,
  caption,
  href,
}: {
  icon: IconName
  title: string
  caption: string
  href: Href
}) {
  const c = usePalette()
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${caption}`}
      onPress={() => router.navigate(href)}
      style={({ pressed }) => [
        s.shortcut,
        {
          backgroundColor: pressed ? c.primarySoft : c.surface,
          borderColor: c.line,
        },
      ]}
    >
      <Icon name={icon} color={c.primary} size={22} />
      <View style={{ flex: 1, gap: 2 }}>
        <Label style={s.shortcutTitle}>{title}</Label>
        <Label muted style={s.caption}>
          {caption}
        </Label>
      </View>
      <Icon name="chevron" color={c.muted} size={14} />
    </Pressable>
  )
}

/** Reserved partner placement (MAR-463 fills it). No partner is shown until real content exists. */
function PartnerSlot() {
  const c = usePalette()
  return (
    <View
      accessibilityRole="summary"
      style={[s.partners, { borderColor: c.line }]}
    >
      <Label style={[s.overline, { color: c.muted }]}>Partenaires</Label>
      <Label muted style={s.caption}>
        Les partenaires de la saison apparaîtront ici.
      </Label>
    </View>
  )
}

const s = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 32, gap: 22 },
  heading: { gap: 6 },
  overline: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countdown: { borderRadius: 22, padding: 22, gap: 4 },
  cardOverline: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  days: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: "800",
    letterSpacing: -1,
  },
  cardDate: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  caption: { fontSize: 14, lineHeight: 20 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  toggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shortcut: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  shortcutTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  partners: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
})
