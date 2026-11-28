import { Pressable, StyleSheet } from "react-native"
import Svg, { Path } from "react-native-svg"
import * as Haptics from "expo-haptics"

import { usePalette } from "~/theme/ui"

const STAR =
  "M12 2.8l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.21l-5.64 2.97 1.08-6.29-4.57-4.45 6.31-.92z"

/** Drawn rather than a font glyph: Material Symbols has no filled star on Android. */
export function StarGlyph({
  filled,
  size = 22,
  color,
}: {
  filled: boolean
  size?: number
  color?: string
}) {
  const c = usePalette()
  const tint = color ?? (filled ? c.primary : c.muted)
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      pointerEvents="none"
    >
      <Path
        d={STAR}
        fill={filled ? tint : "none"}
        stroke={tint}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** ★ toggle for « Mes groupes ». Kept on this phone, no account needed. */
export default function FavoriteStar({
  title,
  favorite,
  onToggle,
}: {
  title: string
  favorite: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        favorite
          ? `Retirer ${title} de Mes groupes`
          : `Ajouter ${title} à Mes groupes`
      }
      accessibilityState={{ selected: favorite }}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined)
        onToggle()
      }}
      style={({ pressed }) => [s.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <StarGlyph filled={favorite} />
    </Pressable>
  )
}
const s = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
})
