
import { invalidateSessionToken } from "@omasla/auth"
import { bearerSession } from "@omasla/auth/native"


export async function POST(req: Request) {
  const authorization = req.headers.get("authorization")
  if (!authorization || !bearerSession(authorization))
    return Response.json({ error: "unauthorized" }, { status: 401 })
  await invalidateSessionToken(authorization)
  return Response.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  )
}
