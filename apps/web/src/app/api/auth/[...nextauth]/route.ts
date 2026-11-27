import { readCookie } from "@omasla/auth"

import type { AuthRequestContext } from "@omasla/auth/request-context"
import {
  handlers,
  invalidateSessionToken,
  isSecureContext,
  validateToken,
} from "@omasla/auth"
import { env } from "@omasla/auth/env"
import {
  completeNativeGrant,
  createNativeGrant,
  NATIVE_COOKIE_NAME,
  NATIVE_FLOW_SECONDS,
  pendingNativeGrantId,
  sessionCookieValue,
} from "@omasla/auth/native"
import { authRequestContext } from "@omasla/auth/request-context"
import { sessionId } from "@omasla/auth/tokens"


export const POST = async (req: Request) => {
  if (new URL(req.url).pathname === "/api/auth/signout") {
    const form = req.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
      ? new URLSearchParams(await req.clone().text())
      : null
    const csrfCookie =
      readCookie(req.headers, "__Host-authjs.csrf-token") ??
      readCookie(req.headers, "authjs.csrf-token")
    const [csrf, signedHash] = csrfCookie?.split("|") ?? []
    // Verify Auth.js' signed double-submit token before the pre-revocation.
    if (
      req.headers.get("origin") !== env.AUTH_ISSUER_URL ||
      !env.AUTH_SECRET ||
      !csrf ||
      form?.get("csrfToken") !== csrf ||
      (await sessionId(`${csrf}${env.AUTH_SECRET}`)) !== signedHash
    ) {
      return Response.json(
        { error: "invalid_signout_request" },
        { status: 403 },
      )
    }
    const token =
      readCookie(req.headers, "__Secure-authjs.session-token") ??
      readCookie(req.headers, "authjs.session-token")
    try {
      if (token && (await validateToken(`Bearer ${token}`)))
        await invalidateSessionToken(`Bearer ${token}`)
    } catch {
      // Auth.js itself swallows adapter signout failures and clears its cookie.
      // Do not call it until revocation succeeds, so a failed logout can be retried.
      return Response.json(
        { error: "logout_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }
  }
  if (
    new URL(req.url).pathname === "/api/auth/signin/email" &&
    req.headers.get("origin") !== env.AUTH_ISSUER_URL
  )
    return Response.json(
      { error: "invalid_signin_origin" },
      { status: 403 },
    )
  return handleAuth(req, "POST")
}

export const GET = async (
  req: Request,
  props: { params: Promise<{ nextauth: string[] }> },
) => {
  const action = (await props.params).nextauth[0]
  const search = new URL(req.url).searchParams
  // The former arbitrary redirect + session_token URL bridge is closed.
  if (search.has("expo-redirect")) {
    return Response.json(
      { error: "unsupported_native_flow" },
      { status: 400 },
    )
  }

  if (action === "signin" && search.has("native_redirect")) {
    const grant = await createNativeGrant(
      search.get("native_redirect"),
      search.get("code_challenge"),
      search.get("state"),
    )
    if (!grant)
      return Response.json(
        { error: "invalid_native_request" },
        { status: 400 },
      )
    const response = await handlers.GET(req)
    response.headers.append(
      "Set-Cookie",
      `${NATIVE_COOKIE_NAME}=${grant.id}; Path=/api/auth; HttpOnly; SameSite=${isSecureContext ? "None; Secure" : "Lax"}; Max-Age=${NATIVE_FLOW_SECONDS}`,
    )
    response.headers.set("Cache-Control", "no-store")
    return response
  }

  return handleAuth(req, "GET")
}

async function handleAuth(req: Request, method: "GET" | "POST") {
  const context: AuthRequestContext = {
    nativeGrantId: await pendingNativeGrantId(
      readCookie(req.headers, NATIVE_COOKIE_NAME),
    ),
  }
  return authRequestContext.run(context, async () => {
    const authResponse = await handlers[method](req)
    const isCallback = new URL(req.url).pathname.startsWith("/api/auth/callback/")
    // Email uses the grant bound to the consumed token, not a cookie from an
    // unrelated browser. OAuth (including Apple's form_post) uses its flow cookie.
    const grantId =
      new URL(req.url).pathname === "/api/auth/callback/email"
        ? context.usedNativeGrantId
        : readCookie(req.headers, NATIVE_COOKIE_NAME)
    if (!isCallback || !grantId) return authResponse
    const sessionToken = sessionCookieValue(authResponse.headers.getSetCookie())
    const location = authResponse.headers.get("location")
    const providerFailed =
      authResponse.status < 300 ||
      authResponse.status >= 400 ||
      !location ||
      new URL(location, req.url).searchParams.has("error")
    const grant =
      !providerFailed && sessionToken
        ? await completeNativeGrant(grantId, sessionToken)
        : null
    if (!grant) {
      const response = Response.json(
        { error: "native_auth_failed" },
        { status: 401 },
      )
      response.headers.append("Set-Cookie", expiredNativeCookie())
      return response
    }
    const url = new URL(grant.redirectUri)
    url.searchParams.set("code", grant.id)
    url.searchParams.set("state", grant.clientState)
    const response = new Response(null, { status: 303, headers: { Location: url.href } })
    for (const cookie of authResponse.headers.getSetCookie())
      response.headers.append("Set-Cookie", cookie)
    response.headers.append("Set-Cookie", expiredNativeCookie())
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("Referrer-Policy", "no-referrer")
    return response
  })
}

function expiredNativeCookie() {
  return `${NATIVE_COOKIE_NAME}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=${isSecureContext ? "None; Secure" : "Lax"}`
}
