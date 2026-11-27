import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useState } from "react"

type SessionStatus = "loading" | "authenticated" | "unauthenticated"
const SessionContext = createContext<{ status: SessionStatus }>({
  status: "loading",
})

async function readAuth(path: string) {
  const response = await fetch(`/api/auth/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Authentication temporarily unavailable")
  return response
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading")
  useEffect(() => {
    let active = true
    let latest = 0
    async function refreshSession() {
      const request = ++latest
      try {
        const response = await readAuth("session")
        const data = (await response.json()) as { user?: unknown } | null
        if (active && request === latest)
          setStatus(data?.user ? "authenticated" : "unauthenticated")
      } catch {
        if (active && request === latest) setStatus("unauthenticated")
      }
    }
    function refresh() {
      void refreshSession()
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      window.removeEventListener("focus", refresh)
    }
  }, [])
  return (
    <SessionContext.Provider value={{ status }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)

export async function getProviders() {
  return (await readAuth("providers")).json() as Promise<
    Record<string, unknown>
  >
}

export async function getCsrfToken() {
  const data = (await (await readAuth("csrf")).json()) as {
    csrfToken?: unknown
  }
  if (typeof data.csrfToken !== "string") throw new Error("Missing CSRF token")
  return data.csrfToken
}

export async function signIn(
  provider: string | undefined,
  options: { email?: string; redirect?: boolean; redirectTo: string },
) {
  const callback = new URL(options.redirectTo, window.location.origin)
  if (callback.origin !== window.location.origin)
    throw new Error("Invalid sign-in destination")
  if (!provider) {
    window.location.assign(
      `/login?${new URLSearchParams({ callbackUrl: callback.href })}`,
    )
    return { ok: true, url: null, error: null }
  }
  if (!["google", "apple", "email"].includes(provider))
    throw new Error("Unknown authentication provider")
  const response = await fetch(`/api/auth/signin/${provider}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken: await getCsrfToken(),
      callbackUrl: callback.href,
      ...(options.email ? { email: options.email } : {}),
    }),
  })
  const result = (await response.json()) as { url?: string }
  const url = result.url ? new URL(result.url, callback) : null
  const error = url?.searchParams.get("error") ?? null
  if (options.redirect !== false && response.ok && url && !error)
    window.location.assign(url.href)
  return { ok: response.ok, url: url?.href ?? null, error }
}
