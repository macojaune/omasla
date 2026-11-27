import type { ReactNode } from "react"
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router"

import { ThemeProvider } from "@omasla/ui/theme"
import { Toaster } from "@omasla/ui/toast"

import { ConvexClientProvider } from "~/app/convex-client-provider"
import appCss from "~/app/globals.css?url"
import { env } from "~/env"
import { TRPCReactProvider } from "~/trpc/react"

const title = "Omasla - Trouve tes groupes de carnaval préférés sans effort"
const description =
  "Suis tes groupes de carnaval préférés en temps réel dans Pointe-à-Pitre."
const socialImage = new URL("/omasla-og-image.png", env.NEXT_PUBLIC_APP_URL)
  .href

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:site_name", content: "Omasla" },
      { property: "og:image", content: socialImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:creator", content: "@macojaune" },
      { name: "twitter:image", content: socialImage },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: Document,
  notFoundComponent: () => (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <Link to="/map" className="underline">
        Revenir à la carte
      </Link>
    </main>
  ),
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        {env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && (
          <script
            src="https://analytics.macojaune.com/script.js"
            data-website-id="638989fa-9ab3-4a30-b342-0c9d4103f87f"
            defer
          />
        )}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ConvexClientProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ConvexClientProvider>
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
