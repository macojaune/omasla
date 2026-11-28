/**
 * What the sign-in button can honestly promise. The Clerk build opens Google
 * only (`oauth_google` in utils/auth); the web flow lists Apple, Google and the
 * passwordless email link that the server has configured.
 */
export interface SignInCopy {
  button: string
  methods: string
  /** Shown when the browser window closes without a session. */
  cancelled: string
}
export function signInCopy(flow: "clerk" | "web"): SignInCopy {
  if (flow === "clerk")
    return {
      button: "Continuer avec Google",
      methods: "Connexion avec ton compte Google.",
      cancelled: "Connexion annulée. Tu peux réessayer quand tu veux.",
    }
  return {
    button: "Se connecter",
    methods:
      "Apple, Google ou lien de connexion par e-mail, sans mot de passe, selon ce que propose la page qui s’ouvre.",
    cancelled:
      "Fenêtre fermée. Si tu as demandé un lien par e-mail, ouvre-le sur ce téléphone pour terminer la connexion.",
  }
}

export type SignInOutcome =
  | { kind: "signed-in" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string }

/** A sign-in failure in plain words; provider codes never reach the screen. */
export function signInError(failure: unknown): string {
  const message = failure instanceof Error ? failure.message : ""
  if (/offline|network|fetch|hors ligne|internet/i.test(message))
    return "La connexion a été interrompue. Vérifie le réseau, puis réessaie."
  if (/étape supplémentaire/i.test(message))
    return "La connexion demande une étape qui n’est pas encore prise en charge dans l’app. Réessaie avec un autre compte ou plus tard."
  if (/expiré|expired/i.test(message))
    return "Cette connexion a expiré. Recommence depuis ce téléphone."
  return "La connexion n’a pas abouti. Réessaie dans un instant."
}

/** Turns the provider's boolean / exception into one of the states the screen shows. */
export async function attemptSignIn(
  signIn: () => Promise<boolean>,
): Promise<SignInOutcome> {
  try {
    return (await signIn()) ? { kind: "signed-in" } : { kind: "cancelled" }
  } catch (failure) {
    return { kind: "failed", message: signInError(failure) }
  }
}
