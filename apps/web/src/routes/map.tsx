import { createFileRoute } from "@tanstack/react-router"

import MapPage from "~/app/map/page"

export const Route = createFileRoute("/map")({ component: MapPage })
