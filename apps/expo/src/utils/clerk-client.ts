import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { getClerkInstance } from "@clerk/expo"
import { tokenCache } from "@clerk/expo/token-cache"

import { getBaseUrl } from "./base-url"

export const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
const pendingKey = "omasla_clerk_logout_pending"
const keychain = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }
let restoreFlight: Promise<void> | undefined

function pendingLogout() {
  return Platform.OS === "web"
    ? Promise.resolve(sessionStorage.getItem(pendingKey))
    : SecureStore.getItemAsync(pendingKey, keychain)
}

async function setPendingLogout(sessionId: string) {
  if (Platform.OS === "web") sessionStorage.setItem(pendingKey, sessionId)
  else await SecureStore.setItemAsync(pendingKey, sessionId, keychain)
}

async function clearPendingLogout() {
  if (Platform.OS === "web") sessionStorage.removeItem(pendingKey)
  else await SecureStore.deleteItemAsync(pendingKey, keychain)
}

function clerk() {
  if (!clerkPublishableKey) return undefined
  return getClerkInstance({ publishableKey: clerkPublishableKey, tokenCache })
}

function postAuth(path: string, token: string) {
  return fetch(`${getBaseUrl()}/api/auth/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  })
}

export async function fetchClerkConvexToken(options?: {
  forceRefreshToken?: boolean
}) {
  const client = clerk()
  if (!client) return null
  // Expo can launch a location task without rendering the React provider.
  if (Platform.OS !== "web" && !client.loaded) {
    restoreFlight ??= client
      .load({
        standardBrowser: false,
        experimental: { runtimeEnvironment: "headless" },
      })
      .finally(() => {
        restoreFlight = undefined
      })
    await restoreFlight
  }
  const session = client.session
  if (!session || (await pendingLogout()) === session.id) return null
  const bearer = await session.getToken({
    skipCache: options?.forceRefreshToken,
  })
  if (!bearer) return null
  const response = await postAuth("convex-token", bearer)
  if (response.status === 401) return null
  if (!response.ok) throw new Error("Connexion temporairement indisponible.")
  const body = (await response.json()) as { token?: unknown }
  if (
    (await pendingLogout()) === session.id ||
    client.session?.id !== session.id
  )
    return null
  return typeof body.token === "string" ? body.token : null
}

export async function signOutClerk() {
  const client = clerk()
  const session = client?.session
  if (!client || !session) {
    await clearPendingLogout()
    return
  }
  await setPendingLogout(session.id)
  const bearer = await session.getToken({ skipCache: true })
  if (!bearer || !(await postAuth("native/logout", bearer)).ok)
    throw new Error(
      "Déconnexion serveur en attente. Rétablis le réseau et réessaie.",
    )
  await client.signOut()
  await clearPendingLogout()
}
