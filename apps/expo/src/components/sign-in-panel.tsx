import { useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"

import { saveAuthReturn } from "~/lib/auth-return"
import { useCatalog } from "~/lib/catalog"
import { attemptSignIn, signInCopy } from "~/lib/sign-in-options"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  usePalette,
} from "~/theme/ui"
import { useNativeAuth } from "~/utils/auth"
import { clerkPublishableKey } from "~/utils/clerk-client"

const copy = signInCopy(clerkPublishableKey ? "clerk" : "web")

/**
 * One sign-in block for every entry point (Moi, adding a position, the login
 * return). It records where to come back to, never publishes anything, and
 * shows loading, cancellation, failure and offline states.
 */
export default function SignInPanel({
  title,
  intro,
  benefits,
  returnGroupId,
  preserveReturn = false,
}: {
  title: string
  intro: string
  benefits?: readonly string[]
  /** Come back to the add-position confirmation of this group. */
  returnGroupId?: string
  /** Keep the destination saved by the screen that started the sign-in. */
  preserveReturn?: boolean
}) {
  const c = usePalette()
  const auth = useNativeAuth()
  const catalog = useCatalog()
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "opening" }
    | { kind: "cancelled" }
    | { kind: "failed"; message: string }
  >({ kind: "idle" })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function connect() {
    if (state.kind === "opening") return
    setState({ kind: "opening" })
    const outcome = await attemptSignIn(async () => {
      if (!preserveReturn) await saveAuthReturn(returnGroupId)
      return auth.signIn()
    })
    if (!mounted.current) return
    setState(
      outcome.kind === "signed-in"
        ? { kind: "idle" }
        : outcome.kind === "cancelled"
          ? { kind: "cancelled" }
          : outcome,
    )
  }
  const opening = state.kind === "opening"
  const finishing = auth.isLoading && !opening
  const failure =
    state.kind === "failed" ? state.message : opening ? null : auth.error
  return (
    <View style={s.panel}>
      <View style={s.intro}>
        <View style={[s.badge, { backgroundColor: c.primarySoft }]}>
          <Icon name="person" color={c.primary} size={30} />
        </View>
        <Label accessibilityRole="header" style={s.title}>
          {title}
        </Label>
        <Label muted>{intro}</Label>
      </View>
      {benefits && benefits.length > 0 && (
        <View style={s.benefits}>
          {benefits.map((benefit) => (
            <View key={benefit} style={s.benefit}>
              <Icon name="check" color={c.primary} size={18} />
              <Label style={s.benefitText}>{benefit}</Label>
            </View>
          ))}
        </View>
      )}
      <View style={s.actions}>
        <Button
          title={copy.button}
          busy={opening || finishing}
          disabled={!catalog.canWrite}
          onPress={() => void connect()}
        />
        <Label muted style={s.caption}>
          {copy.methods} Ton compte est créé à ta première connexion ; rien
          n’est publié sans ton geste.
        </Label>
      </View>
      {(opening || finishing) && (
        <View style={s.progress} accessibilityLiveRegion="polite">
          <LoadingIndicator size={18} />
          <Label muted style={s.caption}>
            {opening
              ? "Termine la connexion dans la fenêtre ouverte. Tu reviendras ici ensuite."
              : "Connexion en cours…"}
          </Label>
        </View>
      )}
      {catalog.offline && (
        <Notice tone="warning">
          Tu es hors ligne. La connexion reviendra avec le réseau ; en
          attendant, tu peux consulter les groupes.
        </Notice>
      )}
      {state.kind === "cancelled" && <Notice>{copy.cancelled}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
    </View>
  )
}

const s = StyleSheet.create({
  panel: { gap: 20 },
  intro: { gap: 14, paddingTop: 8 },
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
  benefits: { gap: 10 },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitText: { flex: 1, fontSize: 16, lineHeight: 22 },
  actions: { gap: 10 },
  caption: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  progress: { flexDirection: "row", alignItems: "center", gap: 12 },
})
