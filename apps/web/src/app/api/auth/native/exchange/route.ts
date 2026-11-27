import { z } from "zod"

import { exchangeNativeGrant } from "@omasla/auth/native"


export async function POST(req: Request) {
  const body = z
    .object({ code: z.string(), verifier: z.string() })
    .strict()
    .safeParse(await req.json().catch(() => null))
  if (!body.success)
    return Response.json({ error: "invalid_request" }, { status: 400 })
  const result = await exchangeNativeGrant(body.data.code, body.data.verifier)
  return Response.json(result ?? { error: "invalid_grant" }, {
    status: result ? 200 : 401,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  })
}
