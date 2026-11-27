import { invalidateSessionToken } from "@omasla/auth"
import { bearerSession } from "@omasla/auth/native"

import {
  clerkConvexLogout,
  clerkEnabled,
} from "../../../../../auth/clerk.server"

export async function POST(req: Request) {
  if (clerkEnabled()) return clerkConvexLogout(req)
  const authorization = req.headers.get("authorization")
  if (!authorization || !bearerSession(authorization))
    return Response.json({ error: "unauthorized" }, { status: 401 })
  await invalidateSessionToken(authorization)
  return Response.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  )
}
