import { createFileRoute } from "@tanstack/react-router"

import AdminError from "~/app/admin/error"
import { OperationsConsole } from "~/app/admin/operations-console"
import { useBrowserAuth } from "~/auth/browser"

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdministrationPage,
  errorComponent: AdminError,
})

function AdministrationPage() {
  const { status } = useBrowserAuth()
  return <OperationsConsole signedIn={status === "authenticated"} />
}
