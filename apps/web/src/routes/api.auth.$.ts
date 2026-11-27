import { createFileRoute } from "@tanstack/react-router"

import { GET, POST } from "~/app/api/auth/[...nextauth]/route"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        GET(request, {
          params: Promise.resolve({
            nextauth: params._splat?.split("/") ?? [],
          }),
        }),
      POST: ({ request }) => POST(request),
    },
  },
})
