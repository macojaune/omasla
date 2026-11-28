import NetInfo from "@react-native-community/netinfo"
import { ConvexHttpClient } from "convex/browser"

import { fetchConvexAccessToken } from "~/utils/auth-client"

/** HTTP calls fail rather than enter ConvexReactClient's offline mutation queue. */
export async function authenticatedClient() {
  const network = await NetInfo.fetch()
  if (network.isConnected !== true || network.isInternetReachable === false)
    throw new Error("Tu es hors ligne. Reconnecte-toi puis réessaie.")
  const token = await fetchConvexAccessToken()
  if (!token) throw new Error("Connecte-toi pour continuer.")
  const url = process.env.EXPO_PUBLIC_CONVEX_URL
  if (!url) throw new Error("Le service est temporairement indisponible.")
  const client = new ConvexHttpClient(url)
  client.setAuth(token)
  return client
}
export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/offline|network|fetch|hors ligne/i.test(message))
    return "La connexion a été interrompue. Vérifie le réseau avant de réessayer."
  if (
    /GROUP_ALREADY_LIVE|LIVE_ACTIVE|live.*active|active.*live|SESSION_ACTIVE/i.test(
      message,
    )
  )
    return "Ce groupe est maintenant suivi en direct. Ta position n’a pas été publiée."
  if (message.includes("INVALID_OBSERVATION_TIME"))
    return "L’heure du relevé n’a pas été acceptée. Vérifie la date et l’heure automatiques du téléphone, puis réessaie avec une nouvelle position."
  if (/SESSION_ENDED|HANDOFF_NOT_AVAILABLE|EMITTER_REVOKED/.test(message))
    return "Ce suivi ou cette proposition de relais n’est plus disponible. Actualise l’onglet Moi."
  if (/AUTH_|UNAUTHENTICATED|TOKEN|Connectez|Connecte-toi/i.test(message))
    return "Ta connexion a expiré. Connecte-toi à nouveau."
  if (/FORBIDDEN|REFERENT|habilit/i.test(message))
    return "Ce compte n’est pas autorisé pour cette action."
  if (/POLICY|CONFIGURATION|configuration/i.test(message))
    return "Le suivi n’est pas encore disponible pour ce groupe."
  return "L’action n’a pas pu être confirmée. Réessaie dans un instant."
}
