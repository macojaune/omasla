import { Linking, Pressable, StyleSheet, View } from "react-native"

import { Icon, Label, usePalette } from "~/theme/ui"

/** IGN data (Licence Ouverte 2.0) must credit its source. The credit lives here instead of over the map. */
export default function MapSources() {
  const c = usePalette()
  return (
    <View style={[s.box, { borderTopColor: c.line }]}>
      <Label accessibilityRole="header" style={s.title}>
        Sources de la carte
      </Label>
      <Label muted style={s.text}>
        Fond de carte : © IGN, Plan IGN. Bâtiments et hauteurs : © IGN, BD
        TOPO®. Données sous Licence Ouverte 2.0.
      </Label>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          void Linking.openURL(
            "https://www.data.gouv.fr/datasets/plan-ign",
          ).catch(() => undefined)
        }
        style={({ pressed }) => [s.link, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Label style={[s.text, { color: c.primary, fontWeight: "600" }]}>
          Voir la source IGN
        </Label>
        <Icon name="arrow" color={c.primary} size={14} />
      </Pressable>
    </View>
  )
}
const s = StyleSheet.create({
  box: { gap: 6, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  text: { fontSize: 13, lineHeight: 19 },
  link: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
})
