import { Pressable, useWindowDimensions, View } from "react-native"
import { useBottomSheet } from "@gorhom/bottom-sheet"

import { usePalette } from "~/theme/ui"

export const DISCOVERY_HANDLE_HEIGHT = 28

/** Native drag affordance with the same operation available to VoiceOver/TalkBack. */
export default function DiscoveryHandle({
  index,
  label,
  levels,
}: {
  index: number
  /** What the panel holds, e.g. « Fiche du groupe ». */
  label: string
  /** One spoken name per snap point, smallest first. */
  levels: string[]
}) {
  const c = usePalette()
  const { width } = useWindowDimensions()
  const { animatedIndex, snapToIndex } = useBottomSheet()
  if (width >= 700) return <View style={{ height: 20 }} />
  const max = Math.max(0, levels.length - 1)
  const move = (delta: number) =>
    snapToIndex(
      Math.max(0, Math.min(max, Math.round(animatedIndex.get()) + delta)),
    )
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max,
        now: Math.max(0, index),
        text: levels[Math.max(0, index)],
      }}
      accessibilityHint="Balaye vers le haut pour agrandir, vers le bas pour réduire."
      accessibilityActions={[
        { name: "increment", label: "Agrandir le panneau" },
        { name: "decrement", label: "Réduire le panneau" },
      ]}
      onAccessibilityAction={(event) =>
        move(event.nativeEvent.actionName === "increment" ? 1 : -1)
      }
      onPress={() => move(animatedIndex.get() >= max ? -1 : 1)}
      hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
      style={{
        height: DISCOVERY_HANDLE_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 36,
          height: 5,
          borderRadius: 3,
          backgroundColor: c.line,
        }}
      />
    </Pressable>
  )
}
