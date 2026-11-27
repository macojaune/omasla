import { createClerkClient, verifyToken } from "@clerk/backend"

import { issueAccessToken, revokeConvexSession } from "@omasla/auth/tokens"

import { readClerkConfiguration } from "./clerk/env"

export function clerkEnabled() {
  return readClerkConfiguration() !== null
}

async function clerkSession(request: Request) {
  const config = readClerkConfiguration()
  const authorization = request.headers.get("authorization")
  if (!config || !authorization || authorization.length > 8192) return null
  const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(authorization)?.[1]
  if (!token) return null

  const claims = await verifyToken(token, {
    secretKey: config.secretKey,
    issuer: config.issuer,
  }).catch(() => null)
  // Clerk can omit azp on requests made by the native SDK without an Origin.
  if (
    !claims ||
    claims.iss !== config.issuer ||
    (claims.azp !== undefined && claims.azp !== config.party) ||
    !/^user_[a-zA-Z0-9]+$/.test(claims.sub) ||
    typeof claims.sid !== "string" ||
    !/^sess_[a-zA-Z0-9]+$/.test(claims.sid)
  )
    return null

  const client = createClerkClient({ secretKey: config.secretKey })
  const session = await client.sessions.getSession(claims.sid).catch(() => null)
  if (
    !session ||
    session.id !== claims.sid ||
    session.status !== "active" ||
    session.userId !== claims.sub ||
    !Number.isFinite(session.expireAt) ||
    session.expireAt <= Date.now()
  )
    return null

  return {
    identity: {
      user: { id: `clerk:${session.userId}`, name: null },
      expires: new Date(session.expireAt).toISOString(),
    },
    sessionKey: `clerk:${session.id}`,
  }
}

const headers = { "Cache-Control": "no-store" }
function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401, headers })
}

export async function clerkConvexToken(request: Request) {
  const session = await clerkSession(request)
  if (!session) return unauthorized()
  const access = await issueAccessToken(session.identity, session.sessionKey)
  return Response.json({ ...access, user: session.identity.user }, { headers })
}

export async function clerkConvexLogout(request: Request) {
  const session = await clerkSession(request)
  if (!session) return unauthorized()
  await revokeConvexSession(session.identity, session.sessionKey)
  return Response.json({ success: true }, { headers })
}
