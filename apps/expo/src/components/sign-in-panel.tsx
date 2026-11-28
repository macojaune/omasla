import { useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"

import type { SocialStrategy } from "~/lib/sign-in-options"
import EmailCodeForm from "~/components/email-code-form"
import { consumeAuthReturn, saveAuthReturn } from "~/lib/auth-return"
import { useCatalog } from "~/lib/catalog"
import {
  attemptSignIn,
  signInMethodsCaption,
  socialCancelled,
  webSignInCopy,
} from "~/lib/sign-in-options"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  usePalette,
} from "~/theme/ui"
import { useNativeAuth } from "~/utils/auth"

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
    | { kind: "opening"; strategy?: SocialStrategy }
    | { kind: "email" }
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
  async function connect(strategy?: SocialStrategy) {
    if (state.kind === "opening") return
    setState({ kind: "opening", strategy })
    const outcome = await attemptSignIn(async () => {
      if (!preserveReturn) await saveAuthReturn(returnGroupId)
      return auth.signIn(strategy)
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
  function emailSignedIn() {
    // The code is checked on this very screen: no browser, no deep link. It
    // already shows the origin, so only drop a return saved by an earlier
    // attempt; the login screen (preserveReturn) consumes and navigates itself.
    if (!preserveReturn) void consumeAuthReturn().catch(() => undefined)
    if (mounted.current) setState({ kind: "idle" })
  }
  const opening = state.kind === "opening"
  const finishing = auth.isLoading && !opening
  const failure =
    state.kind === "failed" ? state.message : opening ? null : auth.error
  const methods = auth.methods
  const caption = methods
    ? signInMethodsCaption(methods, auth.emailSignUp)
    : webSignInCopy.methods
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
      {state.kind === "email" && auth.emailCode ? (
        <EmailCodeForm
          flow={auth.emailCode}
          canSend={catalog.canWrite}
          onCancel={() => setState({ kind: "idle" })}
          onSignedIn={emailSignedIn}
        />
      ) : (
        <View style={s.actions}>
          {methods ? (
            methods.map((method) =>
              method.kind === "social" ? (
                <Button
                  key={method.strategy}
                  title={method.label}
                  busy={
                    finishing ||
                    (opening &&
                      (state.strategy ?? "oauth_google") === method.strategy)
                  }
                  disabled={!catalog.canWrite || opening}
                  onPress={() => void connect(method.strategy)}
                />
              ) : (
                <Button
                  key="email"
                  title={method.label}
                  icon="mail"
                  variant="secondary"
                  disabled={
                    !catalog.canWrite || opening || finishing || !auth.emailCode
                  }
                  onPress={() => setState({ kind: "email" })}
                />
              ),
            )
          ) : (
            <Button
              title={webSignInCopy.button}
              busy={opening || finishing}
              disabled={!catalog.canWrite}
              onPress={() => void connect()}
            />
          )}
          <Label muted style={s.caption}>
            {caption}
          </Label>
        </View>
      )}
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
      {state.kind === "cancelled" && (
        <Notice>{methods ? socialCancelled : webSignInCopy.cancelled}</Notice>
      )}
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
