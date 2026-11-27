"use client"

import type { ReactNode } from "react"
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"

import { BrowserAuthProvider, useBrowserConvexAuth } from "~/auth/browser"
import { env } from "~/env"

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <BrowserAuthProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useBrowserConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    </BrowserAuthProvider>
  )
}
