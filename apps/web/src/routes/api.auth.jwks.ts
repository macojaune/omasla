import { createFileRoute } from "@tanstack/react-router"

import { GET } from "~/app/api/auth/jwks/route"

export const Route = createFileRoute("/api/auth/jwks")({
  server: { handlers: { GET: () => GET() } },
})
