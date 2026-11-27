
import { publicJwks } from "@omasla/auth/tokens"


export async function GET() {
  return Response.json(await publicJwks(), {
    headers: { "Cache-Control": "public, max-age=60" },
  })
}
