import { createFileRoute } from "@tanstack/react-router"

import { POST } from "~/app/api/auth/convex-token/route"

export const Route = createFileRoute("/api/auth/convex-token")({
  server: { handlers: { POST: ({ request }) => POST(request) } },
})
