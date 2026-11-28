import type { SignInResource, SignUpResource } from "@clerk/expo/types"
import type { PropsWithChildren } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState, Linking, Platform } from "react-native"
import {
  ClerkProvider,
  isClerkAPIResponseError,
  useAuth,
  useClerk,
  useUser as useClerkUser,
  useSSO,
} from "@clerk/expo"
import { tokenCache } from "@clerk/expo/token-cache"
import NetInfo from "@react-native-community/netinfo"

import type { NativeUser } from "./auth-client"
import type { SignInMethod, SocialStrategy } from "~/lib/sign-in-options"
import { EmailCodeError, normalizeEmail } from "~/lib/email-sign-in"
import { clerkSignInSettings, signInMethods } from "~/lib/sign-in-options"
import {
  completeNativeSignIn,
  currentUser,
  fetchConvexAccessToken,
  nativeSignIn,
  nativeSignOut,
} from "./auth-client"
import {
  clerkPublishableKey,
  fetchClerkConvexToken,
  signOutClerk,
} from "./clerk-client"

/**
 * One-time code sent by e-mail. `send` signs an existing account in, or
 * starts creating the account when the address is unknown; `verify` resolves
 * once the session is active. No password is ever created.
 */
export interface EmailCodeFlow {
  send: (email: string) => Promise<"sign-in" | "sign-up">
  resend: () => Promise<void>
  verify: (code: string) => Promise<void>
  cancel: () => void
}

interface NativeAuthState {
  isLoading: boolean
  isAuthenticated: boolean
  user: NativeUser | null
  error: string | null
  /** Buttons to show, in order; null for the legacy web flow. */
  methods: SignInMethod[] | null
  /** The e-mail code can also create the account. */
  emailSignUp: boolean
  emailCode: EmailCodeFlow | null
  /** Opens the given provider (Google by default) and resolves false on cancel. */
  signIn: (strategy?: SocialStrategy) => Promise<boolean>
  signOut: () => Promise<void>
  fetchAccessToken: (options?: {
    forceRefreshToken?: boolean
  }) => Promise<string | null>
}

const AuthContext = createContext<NativeAuthState | null>(null)

function LegacyNativeAuth({ children }: PropsWithChildren) {
  const [user, setUser] = useState<NativeUser | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchAccessToken = useCallback(
    async (options?: { forceRefreshToken?: boolean }) => {
      const token = await fetchConvexAccessToken(options)
      setUser(token ? currentUser() : null)
      return token
    },
    [],
  )
  useEffect(() => {
    let mounted = true
    const complete = async (url: string | null | undefined) => {
      if (!url?.startsWith("omasla://login")) return
      if (mounted) {
        setLoading(true)
        setError(null)
      }
      try {
        if (await completeNativeSignIn(url)) {
          if (mounted) setUser(currentUser())
        }
      } catch (reason) {
        if (mounted)
          setError(
            reason instanceof Error
              ? reason.message
              : "La connexion n’a pas abouti.",
          )
      } finally {
        if (mounted) setLoading(false)
      }
    }
    const restore = () => {
      void fetchConvexAccessToken()
        .then((token) => {
          if (mounted) setUser(token ? currentUser() : null)
        })
        .catch(() => {
          // Public consultation remains available if restoring the session needs network.
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }
    restore()
    void Linking.getInitialURL()
      .then(complete)
      .catch(() => undefined)
    const link = Linking.addEventListener("url", ({ url }) => {
      void complete(url)
    })
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) restore()
    })
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") restore()
    })
    return () => {
      mounted = false
      unsubscribeNetwork()
      foreground.remove()
      link.remove()
    }
  }, [])
  const signIn = useCallback(async () => {
    setError(null)
    const success = await nativeSignIn()
    if (success) setUser(currentUser())
    return success
  }, [])
  const signOut = useCallback(async () => {
    await nativeSignOut()
    setUser(null)
  }, [])
  const value = useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      user,
      error,
      methods: null,
      emailSignUp: false,
      emailCode: null,
      signIn,
      signOut,
      fetchAccessToken,
    }),
    [isLoading, user, error, signIn, signOut, fetchAccessToken],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

type PendingEmailCode =
  | { kind: "sign-in"; attempt: SignInResource; emailAddressId: string }
  | { kind: "sign-up"; attempt: SignUpResource }

/** Clerk keeps its loaded environment on an internal getter, absent from its public types. */
function clerkUserSettings(clerk: unknown) {
  const environment = (
    clerk as { __internal_environment?: { userSettings?: unknown } | null }
  ).__internal_environment
  return environment?.userSettings
}

function ClerkNativeAuth({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useClerkUser()
  const clerk = useClerk()
  const { startSSOFlow } = useSSO()
  const signIn = useCallback(
    async (strategy: SocialStrategy = "oauth_google") => {
      const result = await startSSOFlow({
        strategy,
        redirectUrl: "omasla://login",
      })
      if (result.authSessionResult?.type !== "success") return false
      if (!result.createdSessionId || !result.setActive)
        throw new Error("La connexion requiert une étape supplémentaire.")
      await result.setActive({ session: result.createdSessionId })
      return true
    },
    [startSSOFlow],
  )
  // Read once Clerk is loaded: a provider enabled in the dashboard appears at
  // the next launch, without a new build.
  const settings = useMemo(
    () => (isLoaded ? clerkSignInSettings(clerkUserSettings(clerk)) : null),
    [clerk, isLoaded],
  )
  const methods = useMemo(
    () => signInMethods(settings, Platform.OS),
    [settings],
  )
  const emailSignUp = settings?.emailSignUp ?? false
  const pending = useRef<PendingEmailCode | null>(null)
  const generation = useRef(0)
  const emailCode = useMemo<EmailCodeFlow | null>(() => {
    if (!methods.some((method) => method.kind === "email")) return null
    const client = () => {
      // Typed as always present, but undefined until Clerk has loaded.
      const loaded = clerk.client as typeof clerk.client | undefined
      if (!loaded) throw new EmailCodeError("unknown")
      return loaded
    }
    const prepare = async (current: PendingEmailCode) => {
      if (current.kind === "sign-in")
        await current.attempt.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: current.emailAddressId,
        })
      else
        await current.attempt.prepareEmailAddressVerification({
          strategy: "email_code",
        })
    }
    const start = async (email: string): Promise<PendingEmailCode> => {
      try {
        const attempt = await client().signIn.create({ identifier: email })
        const factor = attempt.supportedFirstFactors?.find(
          (item) => item.strategy === "email_code",
        )
        if (!factor || !("emailAddressId" in factor))
          throw new EmailCodeError("extra-step")
        return {
          kind: "sign-in",
          attempt,
          emailAddressId: factor.emailAddressId,
        }
      } catch (failure) {
        const unknownAddress =
          isClerkAPIResponseError(failure) &&
          failure.errors.some(
            (error) => error.code === "form_identifier_not_found",
          )
        if (!unknownAddress) throw failure
      }
      // First connection: the same code creates the account, when Clerk asks
      // for nothing else (a required password would leave it unfinished).
      if (!emailSignUp) throw new EmailCodeError("sign-up-closed")
      const attempt = await client().signUp.create({ emailAddress: email })
      if (attempt.missingFields.length > 0)
        throw new EmailCodeError("sign-up-closed")
      return { kind: "sign-up", attempt }
    }
    return {
      send: async (email) => {
        const ticket = ++generation.current
        pending.current = null
        const current = await start(normalizeEmail(email))
        if (ticket !== generation.current) return current.kind
        await prepare(current)
        if (ticket === generation.current) pending.current = current
        return current.kind
      },
      resend: async () => {
        const current = pending.current
        if (!current) throw new EmailCodeError("expired")
        await prepare(current)
      },
      verify: async (code) => {
        const current = pending.current
        if (!current) throw new EmailCodeError("expired")
        const ticket = generation.current
        const result =
          current.kind === "sign-in"
            ? await current.attempt.attemptFirstFactor({
                strategy: "email_code",
                code,
              })
            : await current.attempt.attemptEmailAddressVerification({ code })
        if (ticket !== generation.current) return
        if (result.status !== "complete" || !result.createdSessionId)
          throw new EmailCodeError(
            current.kind === "sign-up" ? "sign-up-closed" : "extra-step",
          )
        pending.current = null
        await clerk.setActive({ session: result.createdSessionId })
      },
      cancel: () => {
        generation.current += 1
        pending.current = null
      },
    }
  }, [clerk, emailSignUp, methods])
  const value = useMemo<NativeAuthState>(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: !!isSignedIn,
      user: user ? { id: `clerk:${user.id}`, name: user.fullName } : null,
      error: null,
      methods,
      emailSignUp,
      emailCode,
      signIn,
      signOut: signOutClerk,
      fetchAccessToken: fetchClerkConvexToken,
    }),
    [emailCode, emailSignUp, isLoaded, isSignedIn, methods, signIn, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function NativeAuthProvider({ children }: PropsWithChildren) {
  if (clerkPublishableKey)
    return (
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        tokenCache={tokenCache}
      >
        <ClerkNativeAuth>{children}</ClerkNativeAuth>
      </ClerkProvider>
    )
  return <LegacyNativeAuth>{children}</LegacyNativeAuth>
}

export function useNativeAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("NativeAuthProvider is required")
  return context
}

export const useUser = () => useNativeAuth().user
export const useSignIn = () => useNativeAuth().signIn
export const useSignOut = () => useNativeAuth().signOut
export { nativeSignIn as signIn }
