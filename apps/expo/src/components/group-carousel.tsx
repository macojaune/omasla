import type { PropsWithChildren } from "react"
import { useRef } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"

import type { PublicCatalog, PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import type { CarouselItem } from "~/lib/map-view"
import { ageLabel, positionLabel } from "~/lib/catalog-model"
import { groupIdentity } from "~/lib/group-identity"
import { distanceLabel } from "~/lib/map-view"
import { Label, usePalette } from "~/theme/ui"
import GroupEmblem from "./group-emblem"

const GAP = 10
const VIEWABILITY = { itemVisiblePercentThreshold: 70 }

/** Groups inside the current map frame, above the tab bar. */
export default function GroupCarousel({
  items,
  catalog,
  now,
  width,
  largeText,
  onSelect,
  focusedId,
  onFocus,
}: {
  items: CarouselItem[]
  catalog: PublicCatalog
  now: number
  width: number
  largeText: boolean
  onSelect: (group: PublicGroup) => void
  /** Card currently in front; its group is highlighted on the map. */
  focusedId?: string
  onFocus?: (groupId: string) => void
}) {
  const c = usePalette()
  // The next card peeks out to show that the row scrolls.
  const cardWidth = Math.min(largeText ? 340 : 300, width - 64)
  // FlatList requires a stable callback; read the latest handler through a ref.
  const focusRef = useRef(onFocus)
  focusRef.current = onFocus
  const onViewable = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { item: CarouselItem; isViewable: boolean }[]
    }) => {
      const first = viewableItems.find((token) => token.isViewable)
      if (first?.item) focusRef.current?.(first.item.group.id)
    },
  )
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.group.id}
      accessibilityLabel={`Groupes dans ce cadre de la carte · ${items.length}`}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      // The first card that is mostly on screen is the one in front.
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewable.current}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.row}
      ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      renderItem={({ item }) => {
        const { group, position, state, distance } = item
        const focused = focusedId === group.id
        const label = positionLabel(group, catalog, now)
        const age = ageLabel(position, now)
        const distanceText = distance === null ? null : distanceLabel(distance)
        const color =
          state === "live"
            ? c.success
            : positionFreshness(position, catalog.policy, now) === "aging"
              ? c.warning
              : c.ink
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${group.title}. ${label}, ${age}${distanceText ? `, à ${distanceText}` : ""}. Ouvrir la fiche`}
            onPress={() => onSelect(group)}
            style={({ pressed }) => [
              s.card,
              {
                width: cardWidth,
                backgroundColor: c.surface,
                borderColor: focused ? c.primary : "transparent",
                shadowOpacity: c.isDark ? 0.35 : 0.14,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={s.avatar}>
              <GroupEmblem group={group} size={44} />
              {state === "live" && (
                <View
                  style={[
                    s.liveDot,
                    { backgroundColor: c.success, borderColor: c.surface },
                  ]}
                />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Label
                numberOfLines={largeText ? 2 : 1}
                style={{ fontSize: 16, lineHeight: 21, fontWeight: "700" }}
              >
                {groupIdentity(group).name}
              </Label>
              <Label
                numberOfLines={largeText ? 2 : 1}
                style={{ fontSize: 13, lineHeight: 18, color }}
              >
                {label}
                {distanceText ? ` · ${distanceText}` : ""}
              </Label>
              <Label
                muted
                numberOfLines={largeText ? 2 : 1}
                style={{ fontSize: 12, lineHeight: 17 }}
              >
                {age}
              </Label>
            </View>
          </Pressable>
        )
      }}
    />
  )
}

/** Floating card for the map's empty and filtered states. */
export function MapMessage({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  const c = usePalette()
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        s.message,
        {
          backgroundColor: c.surface,
          shadowOpacity: c.isDark ? 0.35 : 0.14,
        },
      ]}
    >
      <Label
        accessibilityRole="header"
        style={{ fontSize: 17, lineHeight: 23, fontWeight: "700" }}
      >
        {title}
      </Label>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    borderWidth: 2,
    minHeight: 76,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#172B46",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  message: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 18,
    gap: 10,
    shadowColor: "#172B46",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
})
