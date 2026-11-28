import { Pressable, StyleSheet, View } from "react-native"

import type { PublicCatalog, PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import { ageLabel, isLiveNow, positionLabel } from "~/lib/catalog-model"
import { Icon, Label, usePalette } from "~/theme/ui"
import FavoriteStar, { StarGlyph } from "./favorite-star"
import GroupEmblem from "./group-emblem"

export default function GroupRow({
  group,
  catalog,
  now,
  onPress,
  favorite = false,
  onToggleFavorite,
}: {
  group: PublicGroup
  catalog: PublicCatalog
  now: number
  onPress: () => void
  /** In « Mes groupes »: a small star next to the name. */
  favorite?: boolean
  /** Shows the ★ toggle instead of the chevron. */
  onToggleFavorite?: () => void
}) {
  const c = usePalette()
  const freshness = positionFreshness(group.position, catalog.policy, now)
  const live = isLiveNow(group, catalog, now)
  const color = live
    ? c.success
    : freshness === "recent"
      ? c.success
      : freshness === "aging"
        ? c.warning
        : c.muted
  return (
    <View style={[s.row, { borderBottomColor: c.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.title}${favorite ? ", dans Mes groupes" : ""}. ${positionLabel(group, catalog, now)}. Voir sur la carte`}
        onPress={onPress}
        style={({ pressed }) => [
          s.main,
          { backgroundColor: pressed ? c.primarySoft : "transparent" },
        ]}
      >
        <View style={s.avatar}>
          <GroupEmblem group={group} size={48} />
          {live && (
            <View
              style={[
                s.dot,
                { backgroundColor: c.success, borderColor: c.surface },
              ]}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={s.name}>
            <Label
              style={{
                fontSize: 17,
                lineHeight: 23,
                fontWeight: "600",
                flexShrink: 1,
              }}
            >
              {group.title}
            </Label>
            {favorite && !onToggleFavorite && <StarGlyph filled size={15} />}
          </View>
          <Label style={{ fontSize: 13, lineHeight: 19, color }}>
            {positionLabel(group, catalog, now)}
          </Label>
          {group.position && freshness !== "hidden" && (
            <Label muted style={{ fontSize: 12, lineHeight: 17 }}>
              {ageLabel(group.position, now)}
            </Label>
          )}
        </View>
        {!onToggleFavorite && <Icon name="chevron" color={c.muted} size={14} />}
      </Pressable>
      {onToggleFavorite && (
        <FavoriteStar
          title={group.title}
          favorite={favorite}
          onToggle={onToggleFavorite}
        />
      )}
    </View>
  )
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 84,
  },
  name: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 3,
  },
})
