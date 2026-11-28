import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import Svg, { Path } from "react-native-svg"

import type { PublicGroup } from "@omasla/convex"

import { groupIdentity } from "~/lib/group-identity"
import { usePalette } from "~/theme/ui"
import GroupEmblem from "./group-emblem"

export type GroupBannerState = "live" | "community" | "aging" | "legacy"

export const GROUP_BANNER_HEIGHT = 96
export const GROUP_BANNER_COMPACT_HEIGHT = 64
export function groupBannerWidth(selected: boolean, compact = false) {
  return selected ? 190 : compact ? 44 : 172
}
export function groupBannerHeight(selected: boolean, compact = false) {
  return compact && !selected
    ? GROUP_BANNER_COMPACT_HEIGHT
    : GROUP_BANNER_HEIGHT
}

/**
 * Anchor the map annotation at the GPS dot's centre, never the name plaque.
 * Layout is 172×96 pt (190×96 selected); GPS is exactly (10, 90) pt.
 * Compact layout is 44×64 pt; GPS is (10, 58) pt, still 6 pt from the bottom.
 * MapLibre v11 ViewAnnotation: anchor="bottom-left", offset={[-10, 6]}.
 * Both layouts use the same offset, keeping GPS anchored through zoom changes.
 */
export const GROUP_BANNER_OFFSET: [number, number] = [-10, 6]

function shortAge(age: string) {
  if (/moins d[’']une minute/i.test(age)) return "< 1 min"
  return age
    .replace(/^il y a\s+/i, "")
    .replace(/minutes?/gi, "min")
    .replace(/heures?/gi, "h")
    .replace(/secondes?/gi, "s")
}

const stateLabels: Record<GroupBannerState, string> = {
  live: "En direct",
  community: "Signalé",
  aging: "Ancien",
  legacy: "Dernier point",
}
// Read on the group's own colour, whatever the theme.
const statusDots: Record<GroupBannerState, string> = {
  live: "#3DDC84",
  community: "#FFFFFF",
  aging: "#FFD58A",
  legacy: "rgba(255,255,255,0.6)",
}
// An ageing point stays visible but steps back from the current ones.
const AGING_OPACITY = 0.55

export default function GroupBanner({
  group,
  selected,
  compact = false,
  state,
  age,
  label,
  onPress,
}: {
  group: PublicGroup
  selected: boolean
  compact?: boolean
  state: GroupBannerState
  age: string
  label: string
  onPress?: () => void
}) {
  const c = usePalette()
  const { fontScale } = useWindowDimensions()
  const identity = groupIdentity(group)
  const isCompact = compact && !selected
  const live = state === "live"
  return (
    <Pressable
      collapsable={false}
      pointerEvents={onPress ? "auto" : "none"}
      accessible={Boolean(onPress)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${group.title}. ${label}. ${age}. Voir le groupe`}
      onPress={(event) => {
        event.stopPropagation()
        onPress?.()
      }}
      style={({ pressed }) => [
        s.banner,
        {
          width: groupBannerWidth(selected, compact),
          height: groupBannerHeight(selected, compact),
          opacity:
            (state === "aging" && !selected ? AGING_OPACITY : 1) *
            (pressed ? 0.78 : 1),
        },
      ]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View
          style={[
            s.pole,
            isCompact && s.compactPole,
            { backgroundColor: c.isDark ? "#D0DAD7" : "#3C514F" },
          ]}
        />
        <View style={[s.flag, isCompact && s.compactFlag]}>
          <Svg
            width={isCompact ? 28 : 36}
            height={isCompact ? 44 : 63}
            viewBox="0 0 36 63"
            preserveAspectRatio="none"
          >
            <Path d="M0 0 36 5 36 63 18 55 0 58Z" fill={identity.color} />
            <Path d="M0 0 3 .42 3 58 0 58Z" fill="#000000" fillOpacity={0.12} />
          </Svg>
          <View style={[s.flagEmblem, isCompact && s.compactEmblem]}>
            <GroupEmblem group={group} size={34} bare />
          </View>
        </View>
        {!isCompact && (
          <View
            key={fontScale}
            style={[
              s.plaque,
              {
                backgroundColor: identity.color,
                borderColor: selected ? c.ink : "transparent",
                shadowOpacity: c.isDark ? 0.3 : 0.14,
              },
            ]}
          >
            <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={s.name}>
              {identity.name}
            </Text>
            <View style={s.status}>
              <View
                style={[
                  s.statusDot,
                  {
                    backgroundColor: statusDots[state],
                    borderColor: live ? "#FFFFFF" : "transparent",
                  },
                ]}
              />
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.5}
                style={s.statusText}
              >
                {stateLabels[state]} · {shortAge(age)}
              </Text>
            </View>
            {live && (
              <View
                style={[
                  s.livePastille,
                  { backgroundColor: statusDots.live, borderColor: c.surface },
                ]}
              />
            )}
          </View>
        )}
        {live && isCompact && (
          <View
            style={[
              s.livePastille,
              s.compactPastille,
              { backgroundColor: statusDots.live, borderColor: c.surface },
            ]}
          />
        )}
        <View
          style={[
            s.gpsDot,
            isCompact && s.compactGpsDot,
            { backgroundColor: identity.color },
          ]}
        />
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  banner: { height: GROUP_BANNER_HEIGHT },
  pole: {
    position: "absolute",
    left: 9,
    top: 3,
    width: 2,
    height: 87,
    borderRadius: 1,
  },
  flag: { position: "absolute", left: 11, top: 7, width: 36, height: 63 },
  flagEmblem: { position: "absolute", left: 1, top: 11 },
  compactPole: { height: 55 },
  compactFlag: { width: 28, height: 44 },
  compactEmblem: { left: -3, top: 3 },
  compactGpsDot: { top: 52 },
  plaque: {
    position: "absolute",
    top: 7,
    left: 49,
    right: 0,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    gap: 3,
    shadowColor: "#152B2A",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  name: { fontSize: 13, fontWeight: "700", lineHeight: 17, color: "#FFFFFF" },
  status: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    flexShrink: 1,
    color: "rgba(255,255,255,0.92)",
  },
  livePastille: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  compactPastille: { top: 3, left: 34, right: undefined },
  gpsDot: {
    position: "absolute",
    left: 4,
    top: 84,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
})
