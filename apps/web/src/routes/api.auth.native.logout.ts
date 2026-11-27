import { createFileRoute } from "@tanstack/react-router"

import { POST } from "~/app/api/auth/native/logout/route"

export const Route = createFileRoute("/api/auth/native/logout")({
  server: { handlers: { POST: ({ request }) => POST(request) } },
})
