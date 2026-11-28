import { useEffect } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import ScreenHeader from "~/components/screen-header"
import { consumeAuthReturn } from "~/lib/auth-return"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  styles,
  usePalette,
} from "~/theme/ui"
import { useNativeAuth } from "~/utils/auth"

// NativeAuthProvider consumes both WebBrowser callbacks and cold/warm deep links.
// Restore only the allowlisted in-app destination, without publishing a draft.
export default function LoginReturn() {
  const auth = useNativeAuth()
  const router = useRouter()
  const c = usePalette()
  useEffect(() => {
    if (!auth.isAuthenticated || auth.isLoading) return
    void consumeAuthReturn()
      .then((destination) => router.replace(destination))
      .catch(() => router.replace("/moi"))
  }, [auth.isAuthenticated, auth.isLoading, router])
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.surface }]}>
      <ScreenHeader title="Connexion" />
      <ScrollView contentContainerStyle={[styles.content, s.content]}>
        <View style={s.intro}>
          <Icon name="person" color={c.primary} size={44} />
          <Label accessibilityRole="header" style={s.title}>
            {auth.error ? "Reprenons la connexion." : "Retrouve ton compte."}
          </Label>
          <Label muted>
            {auth.error
              ? "Reviens à l’onglet Moi pour relancer la connexion."
              : "Termine la connexion dans la fenêtre ouverte. Tu reviendras ensuite là où tu étais."}
          </Label>
        </View>
        {auth.error ? (
          <Notice tone="error">{auth.error}</Notice>
        ) : (
          <View style={s.progress} accessibilityLiveRegion="polite">
            <LoadingIndicator />
            <Label muted style={s.caption}>
              Connexion en cours…
            </Label>
          </View>
        )}
        <Button
          title="Revenir à l’onglet Moi"
          variant="secondary"
          onPress={() => router.replace("/moi")}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  content: { maxWidth: 600, paddingTop: 22, paddingBottom: 28, gap: 28 },
  intro: { gap: 18 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  progress: { flexDirection: "row", alignItems: "center", gap: 12 },
  caption: { fontSize: 15, lineHeight: 22, flexShrink: 1 },
})
