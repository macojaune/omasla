import type { BottomTabBarProps } from "expo-router/js-tabs"
import { useEffect, useState } from "react"
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native"
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"

import type { IconName } from "~/theme/ui"
import { useCatalog } from "~/lib/catalog"
import { useBroadcasting } from "~/lib/use-broadcasting"
import { Icon, Label, usePalette } from "~/theme/ui"

const tabs: Record<string, { title: string; icon: IconName }> = {
  index: { title: "Carte", icon: "map" },
  "ce-soir": { title: "Ce soir", icon: "tonight" },
  groupes: { title: "Groupes", icon: "groups" },
  moi: { title: "Moi", icon: "person" },
}
const order = ["index", "ce-soir", null, "groupes", "moi"] as const

export const TAB_BAR_HEIGHT = 62

/** Carte · Ce soir · + · Groupes · Moi. The centre action is not a tab: it opens the add flow, or the broadcast controls while this phone is live. */
export default function TabBar({
  state,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const c = usePalette()
  const router = useRouter()
  const broadcasting = useBroadcasting()
  const catalog = useCatalog()
  const keyboard = useKeyboardVisible()
  if (keyboard) return null
  const routes = new Map(state.routes.map((route) => [route.name, route]))
  const focusedName = state.routes[state.index]?.name
  const liveTitle = broadcasting
    ? (catalog.data?.groups
        .find((group) => group.id === broadcasting.groupId)
        ?.title.replace(/ · démo$/, "") ?? "ton groupe")
    : null
  return (
    <View>
      {liveTitle && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diffusion en cours pour ${liveTitle}. Ouvrir la diffusion`}
          onPress={() => router.push("/diffusion")}
          style={({ pressed }) => [
            s.banner,
            { backgroundColor: c.success, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[s.bannerDot, { backgroundColor: c.primaryText }]} />
          <Label
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={[s.bannerText, { color: c.primaryText }]}
          >
            Diffusion en cours · {liveTitle}
          </Label>
          <Label
            maxFontSizeMultiplier={1.4}
            style={[s.bannerAction, { color: c.primaryText }]}
          >
            Ouvrir
          </Label>
          <Icon name="chevron" color={c.primaryText} size={14} />
        </Pressable>
      )}
      <View
        accessibilityRole="tablist"
        style={[
          s.bar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.line,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {order.map((name) => {
          if (name === null)
            return (
              <View key="add" style={s.slot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    broadcasting
                      ? "En direct. Ouvrir la diffusion"
                      : "Ajouter une position"
                  }
                  onPress={() => {
                    void Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium,
                    ).catch(() => undefined)
                    router.push(broadcasting ? "/diffusion" : "/ajouter")
                  }}
                  style={({ pressed }) => [
                    s.add,
                    {
                      backgroundColor: broadcasting ? c.success : c.primary,
                      borderColor: c.surface,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  {!broadcasting && (
                    <View style={[s.accent, { backgroundColor: c.accent }]} />
                  )}
                  <Icon
                    name={broadcasting ? "signal" : "plus"}
                    color={c.primaryText}
                    size={broadcasting ? 24 : 28}
                  />
                </Pressable>
                <Label
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  style={[
                    s.label,
                    {
                      color: broadcasting ? c.success : c.ink,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {broadcasting ? "En direct" : "Ajouter"}
                </Label>
              </View>
            )
          const route = routes.get(name)
          const meta = tabs[name]
          if (!route || !meta) return null
          const focused = focusedName === name
          const color = focused ? c.primary : c.muted
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={meta.title}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = emitter.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!focused && !event.defaultPrevented)
                  navigateToTab(route.key)
              }}
              onLongPress={() =>
                emitter.emit({ type: "tabLongPress", target: route.key })
              }
              style={({ pressed }) => [s.slot, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name={meta.icon} color={color} size={23} />
              <Label
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                style={[
                  s.label,
                  { color, fontWeight: focused ? "700" : "600" },
                ]}
              >
                {meta.title}
              </Label>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** Android resizes the window for the keyboard, which would lift the bar over it. */
function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (Platform.OS !== "android") return
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true))
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setVisible(false),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}

const s = StyleSheet.create({
  banner: {
    // The centre button rises 26 pt into this strip: keep the text above it.
    minHeight: 40,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  bannerAction: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    minHeight: TAB_BAR_HEIGHT,
  },
  slot: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  label: { fontSize: 11, lineHeight: 14, textAlign: "center" },
  accent: {
    position: "absolute",
    top: -11,
    width: 20,
    height: 5,
    borderRadius: 3,
  },
  add: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    marginTop: -26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3A1497",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
