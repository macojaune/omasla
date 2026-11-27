import { createFileRoute } from "@tanstack/react-router"

import { GET, OPTIONS, POST } from "~/app/api/trpc/[trpc]/route"

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
      POST: ({ request }) => POST(request),
      OPTIONS,
    },
  },
})
