import { useEffect } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import ScreenHeader from "~/components/screen-header"
import SignInPanel from "~/components/sign-in-panel"
import { consumeAuthReturn } from "~/lib/auth-return"
import { useCatalog } from "~/lib/catalog"
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
  const catalog = useCatalog()
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
        {auth.error ? (
          // Retrying here keeps the destination saved by the original screen.
          <SignInPanel
            title="Reprenons la connexion."
            intro="Le retour de connexion n’a pas abouti. Relance-la : tu reviendras ensuite là où tu étais."
            preserveReturn
          />
        ) : (
          <>
            <View style={s.intro}>
              <View style={[s.badge, { backgroundColor: c.primarySoft }]}>
                <Icon
                  name={auth.isAuthenticated ? "check" : "person"}
                  color={c.primary}
                  size={30}
                />
              </View>
              <Label accessibilityRole="header" style={s.title}>
                {auth.isAuthenticated
                  ? "Connexion réussie."
                  : "Connexion en cours."}
              </Label>
              <Label muted>
                {auth.isAuthenticated
                  ? "Retour à l’écran où tu étais. Rien n’a été publié."
                  : "Termine la connexion dans la fenêtre ouverte. Tu reviendras ensuite là où tu étais, sans rien publier."}
              </Label>
            </View>
            <View style={s.progress} accessibilityLiveRegion="polite">
              <LoadingIndicator />
              <Label muted style={s.caption}>
                {auth.isAuthenticated
                  ? "Retour…"
                  : "Vérification de ton compte…"}
              </Label>
            </View>
            {catalog.offline && (
              <Notice tone="warning">
                Tu es hors ligne. La connexion se terminera quand le réseau
                reviendra.
              </Notice>
            )}
          </>
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
  intro: { gap: 14 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  progress: { flexDirection: "row", alignItems: "center", gap: 12 },
  caption: { fontSize: 15, lineHeight: 22, flexShrink: 1 },
})
