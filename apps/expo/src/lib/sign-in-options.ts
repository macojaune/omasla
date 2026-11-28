/**
 * What the sign-in block can honestly offer. The Clerk build shows only the
 * methods its Clerk instance has enabled (social providers through the web
 * OAuth flow, plus a one-time e-mail code); the legacy web flow lists Apple,
 * Google and the passwordless link that the server has configured.
 */
export type SocialStrategy = "oauth_apple" | "oauth_google"

export type SignInMethod =
  | { kind: "social"; strategy: SocialStrategy; label: string }
  | { kind: "email"; label: string }

/** The part of Clerk's environment (`userSettings`) the sign-in block reads. */
export interface ClerkSignInSettings {
  /** OAuth strategies enabled and usable to sign in. */
  socialStrategies: readonly string[]
  /** A one-time code sent by e-mail can sign an existing account in. */
  emailCode: boolean
  /** The same code can create the account: nothing else (e.g. a password) is required. */
  emailSignUp: boolean
}

/** What the app assumed before reading Clerk's settings: Google only. */
export const fallbackSignInSettings: ClerkSignInSettings = {
  socialStrategies: ["oauth_google"],
  emailCode: false,
  emailSignUp: false,
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null

/**
 * Reads Clerk's `userSettings` resource defensively. Returns null when the
 * environment is not loaded yet or has an unexpected shape.
 */
export function clerkSignInSettings(
  userSettings: unknown,
): ClerkSignInSettings | null {
  const settings = record(userSettings)
  const social = record(settings?.social)
  const attributes = record(settings?.attributes)
  if (!settings || !social || !attributes) return null
  const socialStrategies = Object.entries(social)
    .filter(([, provider]) => {
      const value = record(provider)
      return value?.enabled === true && value.authenticatable !== false
    })
    .map(([key, provider]) => {
      const strategy = record(provider)?.strategy
      return typeof strategy === "string" ? strategy : key
    })
  const email = record(attributes.email_address)
  const firstFactors = Array.isArray(email?.first_factors)
    ? email.first_factors
    : []
  const emailCode =
    email?.enabled === true &&
    email.used_for_first_factor === true &&
    firstFactors.includes("email_code")
  const signUp = record(settings.signUp)
  // A sign-up by code only completes when no other attribute is required:
  // a required password, name or username would leave it unfinished.
  const otherRequirement = Object.entries(attributes).some(([name, value]) => {
    const attribute = record(value)
    return (
      name !== "email_address" &&
      attribute?.enabled === true &&
      attribute.required === true
    )
  })
  return {
    socialStrategies,
    emailCode,
    emailSignUp:
      emailCode && (signUp?.mode ?? "public") === "public" && !otherRequirement,
  }
}

const socialLabels: Record<SocialStrategy, string> = {
  oauth_apple: "Continuer avec Apple",
  oauth_google: "Continuer avec Google",
}

/**
 * The buttons to show, in order. Apple leads on iOS, Google elsewhere; the
 * e-mail code always comes last. A provider appears only once Clerk enables it.
 */
export function signInMethods(
  settings: ClerkSignInSettings | null,
  platform: string,
): SignInMethod[] {
  const { socialStrategies, emailCode } = settings ?? fallbackSignInSettings
  const order: SocialStrategy[] =
    platform === "ios"
      ? ["oauth_apple", "oauth_google"]
      : ["oauth_google", "oauth_apple"]
  const methods: SignInMethod[] = order
    .filter((strategy) => socialStrategies.includes(strategy))
    .map((strategy) => ({
      kind: "social",
      strategy,
      label: socialLabels[strategy],
    }))
  if (emailCode)
    methods.push({ kind: "email", label: "Continuer avec ton e-mail" })
  return methods
}

/** One plain sentence under the buttons, matching what is really shown. */
export function signInMethodsCaption(
  methods: readonly SignInMethod[],
  emailSignUp: boolean,
): string {
  if (methods.length === 0)
    return "La connexion n’est pas disponible pour le moment. Réessaie plus tard."
  const name = (method: SignInMethod) =>
    method.kind === "email"
      ? "un code reçu par e-mail"
      : method.strategy === "oauth_apple"
        ? "Apple"
        : "Google"
  const join = (names: string[]) =>
    names.length === 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`
  const list = join(methods.map(name))
  const social = methods.filter((method) => method.kind === "social")
  const email = methods.some((method) => method.kind === "email")
  if (!email || emailSignUp)
    return `Connexion avec ${list}, sans mot de passe. Ton compte est créé à ta première connexion ; rien n’est publié sans ton geste.`
  if (social.length === 0)
    return `Connexion avec ${list}, pour un compte existant. Rien n’est publié sans ton geste.`
  return `Connexion avec ${list}, sans mot de passe. Pour créer ton compte, passe par ${join(social.map(name))} ; rien n’est publié sans ton geste.`
}

/** Copy of the legacy web flow, where the opened page lists the methods. */
export const webSignInCopy = {
  button: "Se connecter",
  methods:
    "Apple, Google ou lien de connexion par e-mail, sans mot de passe, selon ce que propose la page qui s’ouvre. Ton compte est créé à ta première connexion ; rien n’est publié sans ton geste.",
  cancelled:
    "Fenêtre fermée. Si tu as demandé un lien par e-mail, ouvre-le sur ce téléphone pour terminer la connexion.",
}

/** Shown when the Apple or Google window closes without a session. */
export const socialCancelled =
  "Connexion annulée. Tu peux réessayer quand tu veux."

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
