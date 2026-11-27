import { createFileRoute } from "@tanstack/react-router"

import { useSession } from "@omasla/auth/web-client"

import AdminError from "~/app/admin/error"
import { OperationsConsole } from "~/app/admin/operations-console"

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdministrationPage,
  errorComponent: AdminError,
})

function AdministrationPage() {
  const { status } = useSession()
  return <OperationsConsole signedIn={status === "authenticated"} />
}
