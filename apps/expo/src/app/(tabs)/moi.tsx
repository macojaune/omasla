import { useEffect, useState } from "react"
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useConvexAuth, useQuery } from "convex/react"

import { api } from "@omasla/convex"

import BroadcastCard, {
  AutoStopRules,
  endLabels,
} from "~/components/broadcast-card"
import GroupEmblem from "~/components/group-emblem"
import MapSources from "~/components/map-sources"
import SignInPanel from "~/components/sign-in-panel"
import {
  cancelPendingActivations,
  markStopping,
  readTracking,
  stopCurrentTracking,
  stopNativeLocation,
  withTrackingTransition,
} from "~/lib/background-location"
import { ownsTrackingFeedback } from "~/lib/broadcast-status"
import { useCatalog } from "~/lib/catalog"
import { useLocationHandler } from "~/lib/useLocation"
import { authenticatedClient, friendlyError } from "~/lib/write-api"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  styles,
  usePalette,
} from "~/theme/ui"
import { useNativeAuth } from "~/utils/auth"

const guestBenefits = [
  "Ajoute la position d’un groupe que tu vois passer.",
  "Membre d’un groupe ? Diffuse sa position pendant la sortie.",
] as const

export default function Moi() {
  const c = usePalette()
  const auth = useNativeAuth()
  const convexAuth = useConvexAuth()
  const router = useRouter()
  const catalog = useCatalog()
  const account = useQuery(
    api.accounts.me,
    convexAuth.isAuthenticated ? {} : "skip",
  )
  const tracking = useLocationHandler()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (convexAuth.isAuthenticated)
      void authenticatedClient()
        .then((client) => client.mutation(api.accounts.ensure, {}))
        .catch((failure) => setError(friendlyError(failure)))
  }, [convexAuth.isAuthenticated])
  // Logout stops the broadcast first; this order is unchanged.
  async function logout() {
    cancelPendingActivations()
    let locationStopped = false
    setBusy(true)
    setError(null)
    try {
      const record = await withTrackingTransition(async () => {
        const current = await readTracking()
        if (current) await markStopping(current, "logout")
        await stopNativeLocation()
        return current
      })
      locationStopped = true
      await auth.signOut()
      await stopCurrentTracking(record)
      router.replace("/")
    } catch {
      setError(
        locationStopped
          ? "La diffusion est arrêtée sur ce téléphone. La déconnexion du compte reste à confirmer : rétablis le réseau et réessaie."
          : "L’arrêt de la diffusion n’a pas pu être confirmé. Désactive la localisation dans les réglages et réessaie.",
      )
    } finally {
      setBusy(false)
    }
  }
  const groups = tracking.mine?.groups ?? []
  const active =
    tracking.mine?.sessions.filter((session) => session.status === "active") ??
    []
  const live = groups
    .flatMap((group) => {
      const session = active.find((item) => item.groupId === group.id)
      return session ? [{ group, session }] : []
    })
    // This phone's own broadcast comes first.
    .sort(
      (a, b) =>
        Number(b.session.deviceId === tracking.installation) -
        Number(a.session.deviceId === tracking.installation),
    )
  const idle = groups.filter(
    (group) => !active.some((session) => session.groupId === group.id),
  )
  const ended =
    tracking.mine?.sessions
      .filter((session) => session.status === "ended")
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
      .slice(0, 3) ?? []
  const isMember = groups.length > 0
  const trackingFeedbackInCard = live.some(({ session }) =>
    ownsTrackingFeedback(session, tracking.installation, account?.id),
  )
  const broadcastingHere = live.some(
    ({ session }) =>
      session.isEmitter && session.deviceId === tracking.installation,
  )
  const publicGroup = (id: string) =>
    catalog.data?.groups.find((item) => item.id === id)
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.page, { backgroundColor: c.surface }]}
    >
      <ScrollView contentContainerStyle={[styles.content, s.content]}>
        <Label accessibilityRole="header" style={styles.title}>
          Moi
        </Label>
        {auth.isLoading && !auth.isAuthenticated ? (
          <LoadingIndicator />
        ) : !auth.isAuthenticated ? (
          <>
            <SignInPanel
              title="Connecte-toi pour contribuer."
              intro="Un compte te permet d’aider le public à retrouver les groupes."
              benefits={guestBenefits}
            />
            <View style={[s.guestFooter, { borderTopColor: c.line }]}>
              <Label muted style={s.caption}>
                Pour retrouver les groupes, aucun compte n’est nécessaire.
              </Label>
              <Button
                title="Continuer sans compte"
                variant="secondary"
                onPress={() => router.navigate("/")}
              />
            </View>
          </>
        ) : (
          <>
            {live.map(({ group, session }) => (
              <BroadcastCard
                key={session.id}
                session={session}
                title={group.title}
                group={publicGroup(group.id)}
                accountId={account?.id}
                tracking={tracking}
                blocked={busy}
              />
            ))}
            {!tracking.mine && <LoadingIndicator />}
            {isMember && (
              <View style={styles.section}>
                {idle.length > 0 && (
                  <>
                    <Label accessibilityRole="header" style={s.sectionTitle}>
                      Diffuser
                    </Label>
                    <Label muted style={s.caption}>
                      Démarre uniquement quand tu es avec le groupe. La
                      diffusion continue écran verrouillé ; autorise les
                      notifications pour recevoir ses avertissements.
                    </Label>
                  </>
                )}
                {!trackingFeedbackInCard && tracking.error && (
                  <>
                    <Notice tone="error">{tracking.error}</Notice>
                    {Platform.OS !== "web" && (
                      <Button
                        title="Ouvrir les réglages"
                        variant="secondary"
                        onPress={() => void Linking.openSettings()}
                      />
                    )}
                  </>
                )}
                {!broadcastingHere && tracking.local?.pendingStop && (
                  <Notice tone="warning">
                    {tracking.running
                      ? "L’arrêt de la diffusion reste à confirmer sur ce téléphone. Réessaie ou ouvre les réglages."
                      : "La diffusion est arrêtée sur ce téléphone. Confirme l’arrêt auprès du service pour libérer le groupe."}
                  </Notice>
                )}
                {idle.length > 0 && catalog.offline && (
                  <Notice tone="warning">
                    Hors ligne : démarrer la diffusion demande le réseau.
                  </Notice>
                )}
                {idle.map((group) => {
                  const known = publicGroup(group.id)
                  return (
                    <View
                      key={group.id}
                      style={[s.groupRow, { borderTopColor: c.line }]}
                    >
                      <View style={s.groupHeading}>
                        {known ? (
                          <GroupEmblem group={known} size={40} />
                        ) : (
                          <Icon name="signal" color={c.muted} size={24} />
                        )}
                        <Label style={[s.rowTitle, { flex: 1 }]}>
                          {group.title}
                        </Label>
                      </View>
                      <Button
                        title="Démarrer la diffusion"
                        icon="signal"
                        disabled={
                          busy || !catalog.canWrite || Boolean(tracking.local)
                        }
                        busy={tracking.busy}
                        onPress={() => void tracking.start(group.id)}
                      />
                    </View>
                  )
                })}
                {live.length === 0 && <AutoStopRules />}
              </View>
            )}
            {isMember && ended.length > 0 && (
              <View
                style={[styles.section, s.divided, { borderColor: c.line }]}
              >
                <Label accessibilityRole="header" style={s.sectionTitle}>
                  Dernières diffusions
                </Label>
                {ended.map((session) => (
                  <View
                    key={session.id}
                    style={[s.historyRow, { borderBottomColor: c.line }]}
                  >
                    <Label style={{ fontWeight: "700" }}>
                      {groups.find((group) => group.id === session.groupId)
                        ?.title ??
                        publicGroup(session.groupId)?.title ??
                        "Groupe"}
                    </Label>
                    <Label muted style={{ fontSize: 14 }}>
                      {endLabels[session.endReason ?? ""] ??
                        "Diffusion terminée"}
                      {session.endedAt
                        ? ` · ${new Date(session.endedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </Label>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.section, s.divided, { borderColor: c.line }]}>
              <Label accessibilityRole="header" style={s.sectionTitle}>
                Mon compte
              </Label>
              <View style={s.profile}>
                <Icon name="person" color={c.primary} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Label style={s.rowTitle}>
                    {auth.user?.name ?? "Ton compte"}
                  </Label>
                  <Label muted style={s.caption}>
                    {isMember
                      ? groups.length === 1
                        ? `Membre de ${groups[0]?.title}`
                        : `Membre de ${groups.length} groupes`
                      : "Tu peux ajouter la position des groupes que tu vois."}
                  </Label>
                </View>
              </View>
              {tracking.mine && !isMember && (
                <>
                  <Button
                    title="Ajouter une position"
                    icon="plus"
                    onPress={() => router.push("/ajouter")}
                  />
                  <Label muted style={s.caption}>
                    Tu fais partie d’un groupe ? Sa diffusion apparaîtra ici
                    quand ton accès sera ouvert.
                  </Label>
                </>
              )}
              <Button
                title="Se déconnecter"
                disabled={tracking.busy}
                variant="secondary"
                busy={busy}
                onPress={() => void logout()}
              />
              {broadcastingHere && (
                <Label muted style={s.caption}>
                  La diffusion en cours sera arrêtée avant la déconnexion.
                </Label>
              )}
            </View>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <MapSources />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  content: { maxWidth: 600, paddingTop: 12, paddingBottom: 28, gap: 24 },
  caption: { fontSize: 14, lineHeight: 21 },
  guestFooter: {
    gap: 16,
    marginTop: 4,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rowTitle: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 24 },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    gap: 12,
  },
  groupHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14 },
  historyRow: {
    gap: 4,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
