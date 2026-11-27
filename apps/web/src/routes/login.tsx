import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Omasla" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Outlet,
})
