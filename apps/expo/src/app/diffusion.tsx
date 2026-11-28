import { useEffect } from "react"
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
import ScreenHeader from "~/components/screen-header"
import SignInPanel from "~/components/sign-in-panel"
import { ownsTrackingFeedback } from "~/lib/broadcast-status"
import { useCatalog } from "~/lib/catalog"
import { useLocationHandler } from "~/lib/useLocation"
import { authenticatedClient } from "~/lib/write-api"
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

/** Members broadcast their group's position from here: start, status, relay, stop. */
export default function Broadcast() {
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
  useEffect(() => {
    if (convexAuth.isAuthenticated)
      void authenticatedClient()
        .then((client) => client.mutation(api.accounts.ensure, {}))
        .catch(() => undefined)
  }, [convexAuth.isAuthenticated])
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
  const feedbackInCard = live.some(({ session }) =>
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
      edges={
        Platform.OS === "ios"
          ? ["left", "right", "bottom"]
          : ["top", "left", "right", "bottom"]
      }
      style={[styles.page, { backgroundColor: c.surface }]}
    >
      <ScreenHeader title="Diffusion" />
      <ScrollView contentContainerStyle={[styles.content, s.content]}>
        {auth.isLoading && !auth.isAuthenticated ? (
          <LoadingIndicator />
        ) : !auth.isAuthenticated ? (
          <SignInPanel
            title="Connecte-toi pour diffuser."
            intro="La diffusion est réservée aux membres habilités d’un groupe."
          />
        ) : !tracking.mine ? (
          <LoadingIndicator />
        ) : groups.length === 0 ? (
          <View style={s.empty}>
            <Icon name="signal" color={c.primary} size={40} />
            <Label accessibilityRole="header" style={s.title}>
              Tu n’es membre d’aucun groupe.
            </Label>
            <Label muted>
              La diffusion est ouverte aux membres habilités par l’équipe
              Omasla. En attendant, tu peux ajouter la position d’un groupe que
              tu vois.
            </Label>
            <Button
              title="Ajouter une position"
              icon="plus"
              onPress={() => router.replace("/ajouter")}
            />
          </View>
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
                blocked={false}
              />
            ))}
            {idle.length > 0 && (
              <View style={styles.section}>
                <Label accessibilityRole="header" style={s.sectionTitle}>
                  {live.length ? "Autres groupes" : "Diffuser"}
                </Label>
                <Label muted style={s.caption}>
                  Démarre uniquement quand tu es avec le groupe. La diffusion
                  continue écran verrouillé ; autorise les notifications pour
                  recevoir ses avertissements.
                </Label>
                {!feedbackInCard && tracking.error && (
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
                {catalog.offline && (
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
                        disabled={!catalog.canWrite || Boolean(tracking.local)}
                        busy={tracking.busy}
                        onPress={() => void tracking.start(group.id)}
                      />
                    </View>
                  )
                })}
                {live.length === 0 && <AutoStopRules />}
              </View>
            )}
            {ended.length > 0 && (
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  content: { maxWidth: 600, paddingTop: 8, paddingBottom: 28, gap: 24 },
  empty: { gap: 16, paddingTop: 12 },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  caption: { fontSize: 14, lineHeight: 21 },
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
  historyRow: {
    gap: 4,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
