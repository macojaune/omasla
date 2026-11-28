import { useEffect, useState } from "react"
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { useQuery } from "convex/react"

import type { Id, PublicGroup, SessionView } from "@omasla/convex"
import { api } from "@omasla/convex"

import type { useLocationHandler } from "~/lib/useLocation"
import type { IconName } from "~/theme/ui"
import {
  AUTO_STOP_RULES,
  autoStopDeadline,
  broadcastPoint,
  broadcastWarnings,
  formatClock,
  formatElapsed,
  formatRemaining,
  ownsTrackingFeedback,
  pointLabel,
} from "~/lib/broadcast-status"
import { useCatalog } from "~/lib/catalog"
import { authenticatedClient, friendlyError } from "~/lib/write-api"
import { Icon, Label, LoadingIndicator, usePalette } from "~/theme/ui"
import GroupEmblem from "./group-emblem"

// The status card stays dark in both themes, like the live button it answers to.
// Text and signal colours are the night palette values of theme/ui.
const ink = {
  text: "#F3EEE6",
  muted: "#B5ADA2",
  tile: "rgba(255,255,255,0.08)",
  live: "#15784A",
  liveDot: "#7DD3A8",
  stop: "#E2381F",
  danger: "#FF9A87",
  warning: "#EBBD72",
  info: "#AE93FF",
}

export const endLabels: Record<string, string> = {
  manual: "Arrêté par le membre du groupe",
  moderation: "Arrêté par l’équipe sur le terrain",
  gps_failed: "Localisation indisponible",
  logout: "Compte déconnecté",
  duration: "Durée maximale atteinte",
  zone: "Sortie de la zone de suivi",
  speed: "Vitesse excessive confirmée",
  revoked: "Autorisation de diffusion retirée",
}

type Tracking = ReturnType<typeof useLocationHandler>

/** Server time, advancing locally between catalog updates (same rule as the catalog clock). */
function useServerNow(intervalMs: number) {
  const catalog = useCatalog()
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return catalog.data && catalog.savedAt !== null
    ? catalog.data.serverNow + Math.max(0, Date.now() - catalog.savedAt)
    : Date.now()
}

function CardButton({
  title,
  onPress,
  tone,
  disabled = false,
  busy = false,
  icon,
}: {
  title: string
  onPress: () => void
  tone: "stop" | "neutral" | "go"
  disabled?: boolean
  busy?: boolean
  icon?: IconName
}) {
  const { fontScale } = useWindowDimensions()
  const background =
    tone === "stop" ? ink.stop : tone === "go" ? ink.live : ink.tile
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.cardButton,
        {
          backgroundColor: background,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {busy ? (
        <LoadingIndicator size={18} color="#FFFFFF" />
      ) : icon ? (
        <Icon name={icon} color="#FFFFFF" size={18} />
      ) : null}
      <Text key={fontScale} style={s.cardButtonText}>
        {title}
      </Text>
    </Pressable>
  )
}

/** Explains the three automatic stops. Collapsed by default to keep the commands in view. */
export function AutoStopRules({ dark = false }: { dark?: boolean }) {
  const c = usePalette()
  const [open, setOpen] = useState(false)
  const text = dark ? ink.text : c.ink
  const muted = dark ? ink.muted : c.muted
  return (
    <View style={s.rules}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Comment la diffusion s’arrête-t-elle toute seule ?"
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [s.rulesToggle, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="info" color={muted} size={18} />
        <Label style={[s.rulesTitle, { color: text }]}>
          Comment la diffusion s’arrête toute seule
        </Label>
        <Icon name={open ? "expand" : "down"} color={muted} size={16} />
      </Pressable>
      {open && (
        <View style={s.rulesBody}>
          {AUTO_STOP_RULES.map((rule) => (
            <Label key={rule.key} style={[s.rulesText, { color: muted }]}>
              <Text style={{ color: text, fontWeight: "700" }}>
                {rule.title} ·{" "}
              </Text>
              {rule.text}
            </Label>
          ))}
          <Label style={[s.rulesText, { color: muted }]}>
            Chaque arrêt automatique t’est signalé ici et par une notification
            sur le téléphone, si tu les as autorisées.
          </Label>
        </View>
      )}
    </View>
  )
}

function HandoffPicker({
  session,
  accountId,
  disabled,
  onError,
}: {
  session: SessionView
  accountId: Id<"accounts">
  disabled: boolean
  onError: (message: string | null) => void
}) {
  const referents = useQuery(api.sessions.referents, {
    groupId: session.groupId,
  })
  const [busy, setBusy] = useState(false)
  async function offer(targetAccountId?: Id<"accounts">) {
    setBusy(true)
    onError(null)
    try {
      const client = await authenticatedClient()
      const args = {
        sessionId: session.id,
        deviceId: session.deviceId,
        generation: session.generation,
      }
      if (targetAccountId)
        await client.mutation(api.sessions.offerHandoff, {
          ...args,
          targetAccountId,
        })
      else await client.mutation(api.sessions.cancelHandoff, args)
    } catch (failure) {
      onError(friendlyError(failure))
    } finally {
      setBusy(false)
    }
  }
  const others = referents?.filter((ref) => ref.accountId !== accountId)
  if (session.handoffToAccountId)
    return (
      <View style={s.handoff}>
        <Label style={[s.small, { color: ink.text }]}>
          En attente de{" "}
          {referents?.find(
            (ref) => ref.accountId === session.handoffToAccountId,
          )?.displayName ?? "l’autre membre"}
          . Tu continues à diffuser jusqu’à ce qu’il accepte.
        </Label>
        <CardButton
          title="Annuler la proposition"
          tone="neutral"
          busy={busy}
          disabled={disabled}
          onPress={() => void offer()}
        />
      </View>
    )
  return (
    <View style={s.handoff}>
      <Label style={[s.small, { color: ink.muted }]}>
        Choisis le membre qui prend le relais. Il doit accepter sur son
        téléphone ; tu diffuses jusque-là.
      </Label>
      {!others && <LoadingIndicator color={ink.text} />}
      {others?.length === 0 && (
        <Label style={[s.small, { color: ink.muted }]}>
          Aucun autre membre ne peut diffuser pour ce groupe.
        </Label>
      )}
      {others?.map((ref) => (
        <Pressable
          key={ref.accountId}
          accessibilityRole="button"
          accessibilityLabel={`Proposer le relais à ${ref.displayName}`}
          accessibilityState={{ disabled: busy || disabled, busy }}
          disabled={busy || disabled}
          onPress={() => void offer(ref.accountId)}
          style={({ pressed }) => [
            s.referentRow,
            { opacity: busy || disabled ? 0.5 : pressed ? 0.65 : 1 },
          ]}
        >
          <Label style={{ color: ink.text, flex: 1, fontWeight: "600" }}>
            {ref.displayName}
          </Label>
          <Label style={[s.small, { color: ink.info }]}>Proposer</Label>
          <Icon name="chevron" color={ink.muted} size={16} />
        </Pressable>
      ))}
    </View>
  )
}

/**
 * MAR-457 — the live status of one group, at the top of Moi: who broadcasts,
 * since when, the last point, zone / speed / automatic stop, every warning in
 * one list, and the commands. Stop and handoff keep their existing flows.
 */
export default function BroadcastCard({
  session,
  title,
  group,
  accountId,
  tracking,
  blocked,
}: {
  session: SessionView
  title: string
  group: PublicGroup | undefined
  accountId: Id<"accounts"> | undefined
  tracking: Tracking
  /** Another account action (logout) is in progress. */
  blocked: boolean
}) {
  const c = usePalette()
  const catalog = useCatalog()
  const now = useServerNow(5_000)
  const events = useQuery(api.sessions.events, { sessionId: session.id })
  const [picking, setPicking] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const ownDevice =
    session.isEmitter && session.deviceId === tracking.installation
  const running =
    ownDevice && tracking.running && tracking.local?.sessionId === session.id
  const pendingStop = ownDevice && Boolean(tracking.local?.pendingStop)
  const point = broadcastPoint(session, group?.position, now)
  const deadline = autoStopDeadline(session, now)
  const warnings = broadcastWarnings({
    ownDevice,
    offline: catalog.offline,
    running,
    pendingStop,
    trackingError: ownsTrackingFeedback(
      session,
      tracking.installation,
      accountId,
    )
      ? tracking.error
      : null,
    handoffError,
    notificationsAllowed: tracking.notificationsAllowed,
    speedWarning: Boolean(session.speedWarningAt),
    point,
    deadline,
    handoffPending: ownDevice && Boolean(session.handoffToAccountId),
  })
  const offeredToMe =
    accountId !== undefined &&
    session.handoffToAccountId === accountId &&
    !session.isEmitter
  const canHandOff = ownDevice && session.status === "active" && !pendingStop
  const toneColor = { danger: ink.danger, warning: ink.warning, info: ink.info }
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: c.isDark ? "#2E2A36" : c.ink,
          borderColor: c.isDark ? c.line : "transparent",
        },
      ]}
    >
      <View style={s.headerRow}>
        <View style={[s.pill, { backgroundColor: ink.live }]}>
          <View style={[s.dot, { backgroundColor: ink.liveDot }]} />
          <Text style={s.pillText}>
            {ownDevice ? "TU DIFFUSES" : "EN DIRECT"}
          </Text>
        </View>
        <Label style={[s.small, { color: ink.muted }]}>
          {formatElapsed(now - session.startedAt)}
        </Label>
      </View>
      <View style={s.groupRow}>
        {group ? (
          <GroupEmblem group={group} size={46} />
        ) : (
          <Icon name="signal" color={ink.text} size={32} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Label
            accessibilityRole="header"
            style={[s.groupTitle, { color: ink.text }]}
          >
            {title}
          </Label>
          <Label
            style={[
              s.small,
              {
                color:
                  point.kind === "late" || point.kind === "missing"
                    ? ink.warning
                    : ink.muted,
              },
            ]}
          >
            {pointLabel(point)}
          </Label>
        </View>
      </View>
      {!ownDevice && (
        <Label style={[s.small, { color: ink.text }]}>
          {session.isEmitter
            ? "Tu diffuses depuis un autre téléphone. Arrête la diffusion depuis ce téléphone-là."
            : "Un autre membre du groupe diffuse la position."}
        </Label>
      )}
      {/* Zone and speed only show up when something is wrong (warnings below). */}
      <Label
        style={[s.small, { color: deadline.soon ? ink.warning : ink.muted }]}
      >
        Arrêt automatique {formatRemaining(deadline.remainingMs)}, à{" "}
        {formatClock(deadline.at)}
      </Label>
      {warnings.length > 0 && (
        <View
          style={[s.warnings, { backgroundColor: ink.tile }]}
          accessibilityLiveRegion="polite"
        >
          {warnings.map((warning) => (
            <View key={warning.key} style={s.warningRow}>
              <View
                style={[
                  s.dot,
                  s.warningDot,
                  { backgroundColor: toneColor[warning.tone] },
                ]}
              />
              <Label style={[s.small, { color: ink.text, flex: 1 }]}>
                {warning.text}
              </Label>
            </View>
          ))}
          {ownDevice && tracking.error && Platform.OS !== "web" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Label style={[s.small, { color: ink.info, fontWeight: "700" }]}>
                Ouvrir les réglages
              </Label>
            </Pressable>
          )}
        </View>
      )}
      {ownDevice && !running && !pendingStop && (
        <CardButton
          title="Reprendre sur ce téléphone"
          tone="go"
          icon="signal"
          disabled={blocked || !catalog.canWrite}
          busy={tracking.busy}
          onPress={() => void tracking.resume(session)}
        />
      )}
      {ownDevice && (
        <View style={s.commands}>
          {canHandOff && !session.handoffToAccountId && (
            <View style={{ flex: 1 }}>
              <CardButton
                title={picking ? "Fermer" : "Passer le relais"}
                tone="neutral"
                disabled={blocked || tracking.busy || !catalog.canWrite}
                onPress={() => setPicking((value) => !value)}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <CardButton
              title={pendingStop ? "Confirmer l’arrêt" : "Arrêter"}
              tone="stop"
              icon="stop"
              disabled={blocked}
              busy={tracking.busy}
              onPress={() => void tracking.stop("manual", session)}
            />
          </View>
        </View>
      )}
      {canHandOff &&
        accountId !== undefined &&
        (picking || session.handoffToAccountId) && (
          <HandoffPicker
            session={session}
            accountId={accountId}
            disabled={blocked || tracking.busy || !catalog.canWrite}
            onError={setHandoffError}
          />
        )}
      {offeredToMe && (
        <View style={s.handoff}>
          <Label style={[s.small, { color: ink.text }]}>
            Un membre du groupe te propose de prendre le relais. En acceptant,
            c’est ton téléphone qui diffuse.
          </Label>
          <CardButton
            title="Accepter le relais"
            tone="go"
            icon="check"
            disabled={blocked || !catalog.canWrite}
            busy={tracking.busy}
            onPress={() => void tracking.accept(session)}
          />
        </View>
      )}
      <AutoStopRules dark />
      {events && events.length > 0 && (
        <View style={s.events}>
          {events
            .slice(-3)
            .reverse()
            .map((event) => (
              <Label key={event.id} style={[s.small, { color: ink.muted }]}>
                {formatClock(event.occurredAt)} ·{" "}
                {event.type === "speed_warning"
                  ? "Avertissement de vitesse"
                  : event.type === "handoff"
                    ? "Relais accepté"
                    : (endLabels[event.reason ?? ""] ?? "Diffusion terminée")}
              </Label>
            ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  groupTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  small: { fontSize: 14, lineHeight: 20 },
  warnings: { borderRadius: 14, padding: 12, gap: 10 },
  warningRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  warningDot: { marginTop: 6 },
  commands: { flexDirection: "row", gap: 10 },
  cardButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cardButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  handoff: { gap: 10 },
  referentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  rules: { gap: 8 },
  rulesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
  },
  rulesTitle: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  rulesBody: { gap: 8 },
  rulesText: { fontSize: 14, lineHeight: 20 },
  events: { gap: 4 },
})
