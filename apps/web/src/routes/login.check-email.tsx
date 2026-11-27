import { createFileRoute } from "@tanstack/react-router"

import CheckEmailPage from "~/app/login/check-email/page"

export const Route = createFileRoute("/login/check-email")({
  component: CheckEmailPage,
})
