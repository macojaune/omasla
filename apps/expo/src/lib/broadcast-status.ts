import type { PublicPosition, SessionView } from "@omasla/convex"

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/** Native updates are requested every 15 s; past this delay the card says the points are late. Display hint only, not a stop rule. */
export const LATE_POINT_MS = 2 * MINUTE
/** The duration deadline is highlighted when it gets this close. */
export const DEADLINE_SOON_MS = 15 * MINUTE

const pad = (value: number) => String(value).padStart(2, "0")

/** "45 s", "12 min", "1 h 05" — whole units, rounded down. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  if (safe < MINUTE) return `${Math.floor(safe / SECOND)} s`
  if (safe < HOUR) return `${Math.floor(safe / MINUTE)} min`
  const hours = Math.floor(safe / HOUR)
  const minutes = Math.floor((safe % HOUR) / MINUTE)
  return `${hours} h ${pad(minutes)}`
}

/** "depuis 42 min" for the elapsed broadcast. */
export function formatElapsed(ms: number): string {
  return ms < MINUTE
    ? "depuis moins d’une minute"
    : `depuis ${formatDuration(ms)}`
}

/** "il y a 12 s" for the age of the last point. Clock skew never shows a future point. */
export function formatAge(ms: number): string {
  return ms < 5 * SECOND ? "à l’instant" : `il y a ${formatDuration(ms)}`
}

/** "dans 3 h 18" until the automatic stop. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "imminent"
  if (ms < MINUTE) return "dans moins d’une minute"
  return `dans ${formatDuration(ms)}`
}

/** Local wall-clock "23:05". */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export type PointState =
  | { kind: "waiting" }
  | { kind: "missing"; sinceMs: number }
  | { kind: "fresh"; ageMs: number }
  | { kind: "late"; ageMs: number }

/**
 * The last point accepted by the server for this session, read from the public
 * group position: only a member-sourced point received after the session start
 * counts, so an older observation never passes for a live point.
 */
export function broadcastPoint(
  session: Pick<SessionView, "startedAt">,
  position: PublicPosition | null | undefined,
  now: number,
): PointState {
  const received =
    position?.source === "referent" && position.receivedAt >= session.startedAt
      ? position.receivedAt
      : null
  if (received === null) {
    const sinceMs = Math.max(0, now - session.startedAt)
    return sinceMs < LATE_POINT_MS
      ? { kind: "waiting" }
      : { kind: "missing", sinceMs }
  }
  const ageMs = Math.max(0, now - received)
  return ageMs < LATE_POINT_MS
    ? { kind: "fresh", ageMs }
    : { kind: "late", ageMs }
}

export function pointLabel(point: PointState): string {
  switch (point.kind) {
    case "waiting":
      return "Premier point en cours d’envoi…"
    case "missing":
      return `Aucun point reçu ${formatElapsed(point.sinceMs)}`
    case "fresh":
    case "late":
      return `Dernier point envoyé ${formatAge(point.ageMs)}`
  }
}

export interface Deadline {
  remainingMs: number
  at: number
  soon: boolean
}
export function autoStopDeadline(
  session: Pick<SessionView, "expiresAt">,
  now: number,
): Deadline {
  const remainingMs = session.expiresAt - now
  return {
    remainingMs,
    at: session.expiresAt,
    soon: remainingMs <= DEADLINE_SOON_MS,
  }
}

/**
 * The card that shows this phone's own tracking feedback (start, resume,
 * accept or stop errors): the session this phone emits, or the handoff
 * offered to this account. Otherwise Moi shows that feedback itself.
 */
export function ownsTrackingFeedback(
  session: Pick<SessionView, "isEmitter" | "deviceId" | "handoffToAccountId">,
  installation: string | null,
  accountId: string | undefined,
): boolean {
  return (
    (session.isEmitter && session.deviceId === installation) ||
    (!session.isEmitter &&
      accountId !== undefined &&
      session.handoffToAccountId === accountId)
  )
}

export type WarningTone = "danger" | "warning" | "info"
export interface BroadcastWarning {
  key: string
  tone: WarningTone
  text: string
}
export interface WarningInput {
  /** This phone is the emitter of the session shown. */
  ownDevice: boolean
  offline: boolean
  /** The native location task runs for this session on this phone. */
  running: boolean
  pendingStop: boolean
  trackingError: string | null
  /** A failed handoff offer or cancellation. */
  handoffError?: string | null
  notificationsAllowed: boolean | null
  speedWarning: boolean
  point: PointState
  deadline: Deadline
  /** A handoff proposed by this phone waits for the other member. */
  handoffPending: boolean
}

const toneRank: Record<WarningTone, number> = { danger: 0, warning: 1, info: 2 }

/** Every warning about the broadcast, most serious first, so the card shows one grouped list instead of stacked banners. */
export function broadcastWarnings(input: WarningInput): BroadcastWarning[] {
  const list: BroadcastWarning[] = []
  if (input.trackingError)
    list.push({ key: "error", tone: "danger", text: input.trackingError })
  if (input.handoffError)
    list.push({
      key: "handoff-error",
      tone: "danger",
      text: input.handoffError,
    })
  if (input.ownDevice && input.pendingStop)
    list.push({
      key: "pending-stop",
      tone: "danger",
      text: input.running
        ? "L’arrêt reste à confirmer sur ce téléphone. Réessaie ou ouvre les réglages."
        : "La collecte est arrêtée sur ce téléphone. Confirme l’arrêt pour libérer le groupe.",
    })
  else if (input.ownDevice && !input.running)
    list.push({
      key: "not-running",
      tone: "danger",
      text: "La position ne part plus de ce téléphone. Reprends la diffusion ou arrête-la.",
    })
  if (input.speedWarning)
    list.push({
      key: "speed",
      tone: "danger",
      text: "Ta vitesse semble trop élevée pour le défilé. Si elle reste élevée, la diffusion s’arrête automatiquement.",
    })
  if (input.offline)
    list.push({
      key: "offline",
      tone: "warning",
      text: input.ownDevice
        ? "Hors ligne : les points ne sont pas envoyés. Tu peux toujours arrêter la diffusion sur ce téléphone."
        : "Hors ligne : l’état affiché peut être ancien.",
    })
  if (
    !input.offline &&
    (input.point.kind === "late" || input.point.kind === "missing")
  )
    list.push({
      key: "point",
      tone: "warning",
      text: input.ownDevice
        ? "Les points n’arrivent plus. Vérifie le réseau et que la localisation reste autorisée « Toujours »."
        : "Les points n’arrivent plus depuis le téléphone qui diffuse.",
    })
  if (input.deadline.soon)
    list.push({
      key: "deadline",
      tone: "warning",
      text:
        input.deadline.remainingMs > 0
          ? `La durée maximale est presque atteinte : arrêt automatique à ${formatClock(input.deadline.at)}.`
          : "La durée maximale est atteinte : la diffusion s’arrête.",
    })
  if (input.ownDevice && input.notificationsAllowed === false)
    list.push({
      key: "notifications",
      tone: "info",
      text: "Notifications désactivées : les avertissements n’apparaîtront qu’ici. Active-les dans les réglages pour les recevoir écran verrouillé.",
    })
  if (input.handoffPending)
    list.push({
      key: "handoff",
      tone: "info",
      text: "Relais proposé. Tu continues à diffuser jusqu’à ce qu’il soit accepté.",
    })
  return list
    .map((warning, index) => ({ warning, index }))
    .sort(
      (a, b) =>
        toneRank[a.warning.tone] - toneRank[b.warning.tone] ||
        a.index - b.index,
    )
    .map(({ warning }) => warning)
}

/** The automatic stop rules, as explained in the app. Thresholds are set by the team and are not exposed to the app. */
export const AUTO_STOP_RULES = [
  {
    key: "zone",
    title: "Zone",
    text: "Si tu sors de la zone de suivi autour de Pointe-à-Pitre et que la sortie se confirme, la diffusion s’arrête.",
  },
  {
    key: "speed",
    title: "Vitesse",
    text: "Une vitesse de véhicule qui dure déclenche d’abord un avertissement, puis l’arrêt si elle continue.",
  },
  {
    key: "duration",
    title: "Durée",
    text: "Chaque diffusion a une durée maximale ; l’heure d’arrêt est affichée dans la carte.",
  },
] as const
