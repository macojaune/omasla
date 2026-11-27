import { readCookie, validateToken } from "@omasla/auth"
import { env } from "@omasla/auth/env"
import { bearerSession } from "@omasla/auth/native"
import { issueAccessToken } from "@omasla/auth/tokens"

import { clerkConvexToken, clerkEnabled } from "../../../../auth/clerk.server"

export async function POST(req: Request) {
  if (clerkEnabled()) return clerkConvexToken(req)
  const authorization = req.headers.get("authorization")
  let token = bearerSession(authorization)
  if (!authorization) {
    const origin = req.headers.get("origin")
    if (
      !origin ||
      origin !== env.AUTH_ISSUER_URL ||
      req.headers.get("content-type") !== "application/json"
    ) {
      return Response.json({ error: "invalid_origin" }, { status: 403 })
    }
    token =
      readCookie(req.headers, "__Secure-authjs.session-token") ??
      readCookie(req.headers, "authjs.session-token") ??
      null
  }
  const session = token ? await validateToken(`Bearer ${token}`) : null
  if (!token || !session)
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  const access = await issueAccessToken(session, token)
  return Response.json(
    {
      ...access,
      user: { id: session.user.id, name: session.user.name ?? null },
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
