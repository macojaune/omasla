import { createFileRoute } from "@tanstack/react-router"

import { POST } from "~/app/api/auth/native/exchange/route"

export const Route = createFileRoute("/api/auth/native/exchange")({
  server: { handlers: { POST: ({ request }) => POST(request) } },
})
