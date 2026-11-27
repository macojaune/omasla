import type { PropsWithChildren } from "react"
import { createContext, useCallback, useContext, useMemo } from "react"
import { ClerkProvider, useAuth, useClerk } from "@clerk/tanstack-react-start"

import { safeSignOut } from "@omasla/auth/convex-client"
import { SessionProvider, useSession } from "@omasla/auth/web-client"

import { env } from "~/env"

type Status = ReturnType<typeof useSession>["status"]
interface BrowserAuth {
  status: Status
  accessToken: (options?: {
    forceRefreshToken?: boolean
  }) => Promise<string | null>
  signOut: () => Promise<void>
}

const BrowserSession = createContext<BrowserAuth | null>(null)

async function postAuth(path: string, token?: string) {
  return fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: "{}",
    credentials: "same-origin",
    cache: "no-store",
  })
}

async function accessToken(token?: string) {
  const response = await postAuth("convex-token", token)
  if (response.status === 401) return null
  if (!response.ok) throw new Error("Connexion temporairement indisponible.")
  const body = (await response.json()) as { token?: unknown }
  return typeof body.token === "string" ? body.token : null
}

const legacySignOut = () => safeSignOut("/map")

function LegacySession({ children }: PropsWithChildren) {
  const { status } = useSession()
  const value = useMemo(
    () => ({
      status,
      accessToken: () =>
        status === "authenticated" ? accessToken() : Promise.resolve(null),
      signOut: legacySignOut,
    }),
    [status],
  )
  return (
    <BrowserSession.Provider value={value}>{children}</BrowserSession.Provider>
  )
}

function ClerkSession({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()
  const fetchAccessToken = useCallback<BrowserAuth["accessToken"]>(
    async (options) => {
      const token = await getToken({ skipCache: options?.forceRefreshToken })
      return token ? accessToken(token) : null
    },
    [getToken],
  )
  const signOut = useCallback(async () => {
    const token = await getToken({ skipCache: true })
    if (!token || !(await postAuth("native/logout", token)).ok)
      throw new Error("Déconnexion non confirmée. Réessaie une fois connecté.")
    await clerk.signOut({ redirectUrl: "/map" })
  }, [clerk, getToken])
  const status = !isLoaded
    ? "loading"
    : isSignedIn
      ? "authenticated"
      : "unauthenticated"
  const value = useMemo<BrowserAuth>(
    () => ({ status, accessToken: fetchAccessToken, signOut }),
    [fetchAccessToken, signOut, status],
  )
  return (
    <BrowserSession.Provider value={value}>{children}</BrowserSession.Provider>
  )
}

export function BrowserAuthProvider({ children }: PropsWithChildren) {
  const key = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (key)
    return (
      <ClerkProvider publishableKey={key} signInUrl="/login" signUpUrl="/login">
        <ClerkSession>{children}</ClerkSession>
      </ClerkProvider>
    )
  return (
    <SessionProvider>
      <LegacySession>{children}</LegacySession>
    </SessionProvider>
  )
}

export function useBrowserAuth() {
  const state = useContext(BrowserSession)
  if (!state) throw new Error("BrowserAuthProvider is required")
  return state
}

export function useBrowserConvexAuth() {
  const { status, accessToken } = useBrowserAuth()
  return {
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    fetchAccessToken: accessToken,
  }
}
