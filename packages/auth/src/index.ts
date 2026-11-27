import { Auth } from "@auth/core"

import { env } from "../env"
import { authConfig, validateToken } from "./config"

function authHandler(request: Request) {
  const incoming = new URL(request.url)
  if (!env.AUTH_URL) return Auth(request, authConfig)
  const canonical = new URL(env.AUTH_URL)
  canonical.pathname = incoming.pathname
  canonical.search = incoming.search
  return Auth(new Request(canonical, request), authConfig)
}

export const handlers = { GET: authHandler, POST: authHandler }

export function readCookie(headers: Headers, name: string) {
  const prefix = name + "="
  const cookie = headers.get("cookie")?.split(";").map((value) => value.trim())
    .find((value) => value.startsWith(prefix))?.slice(prefix.length)
  if (!cookie) return undefined
  try {
    return decodeURIComponent(cookie)
  } catch {
    return undefined
  }
}

export async function auth(headers: Headers) {
  const token =
    readCookie(headers, "__Secure-authjs.session-token") ??
    readCookie(headers, "authjs.session-token")
  return token ? await validateToken(`Bearer ${token}`) : null
}

export { invalidateSessionToken, validateToken, isSecureContext } from "./config"
export type { Session } from "@auth/core/types"
