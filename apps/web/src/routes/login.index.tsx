import { createFileRoute } from "@tanstack/react-router"

import { LoginForm } from "~/app/login/login-form"
import { env } from "~/env"

export const Route = createFileRoute("/login/")({
  validateSearch: (search: Record<string, unknown>) => ({
    callbackUrl:
      typeof search.callbackUrl === "string" ? search.callbackUrl : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const params = Route.useSearch()
  let callbackUrl = "/map"
  if (params.callbackUrl) {
    try {
      const origin = new URL(env.NEXT_PUBLIC_APP_URL).origin
      const target = new URL(params.callbackUrl, origin)
      if (
        target.origin === origin &&
        !target.pathname.startsWith("/api/auth") &&
        !target.pathname.startsWith("/login")
      ) {
        callbackUrl = `${target.pathname}${target.search}${target.hash}`
      }
    } catch {
      // Invalid destinations return to the public map.
    }
  }
  return <LoginForm callbackUrl={callbackUrl} error={params.error} />
}
