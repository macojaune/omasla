/**
 * Pure rules of the e-mail code sign-in: what counts as an address or a code,
 * when a new code may be asked for, and how a failure reads on screen.
 */
export const codeLength = 6
/** Seconds before "Renvoyer le code" becomes available again. */
export const resendDelaySeconds = 30

export function normalizeEmail(input: string) {
  return input.trim()
}

/** A plausible address; the server stays the judge of deliverability. */
export function isValidEmail(input: string) {
  const email = normalizeEmail(input)
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(email)
  )
}

/** Keeps the digits only (a pasted "123 456" or "123-456" still works). */
export function normalizeCode(input: string) {
  return input.replace(/\D/g, "").slice(0, codeLength)
}

export function isCompleteCode(input: string) {
  return new RegExp(`^\\d{${codeLength}}$`).test(input)
}

/** Whole seconds left before a new code can be sent; 0 when it can. */
export function resendCountdown(sentAt: number, now: number) {
  const left = resendDelaySeconds - Math.floor((now - sentAt) / 1000)
  return Math.max(0, Math.min(resendDelaySeconds, left))
}

export type EmailCodeFailure =
  | "invalid-email"
  | "wrong-code"
  | "expired"
  | "too-many"
  | "offline"
  | "sign-up-closed"
  | "extra-step"
  | "unknown"

/** Raised by the auth layer for outcomes that are not Clerk API errors. */
export class EmailCodeError extends Error {
  constructor(readonly kind: EmailCodeFailure) {
    super(kind)
    this.name = "EmailCodeError"
  }
}

const failureByCode: Record<string, EmailCodeFailure> = {
  form_param_format_invalid: "invalid-email",
  form_identifier_invalid: "invalid-email",
  form_email_address_invalid: "invalid-email",
  form_code_incorrect: "wrong-code",
  verification_expired: "expired",
  verification_failed: "too-many",
  too_many_requests: "too-many",
  user_locked: "too-many",
  sign_up_mode_restricted: "sign-up-closed",
  not_allowed_access: "sign-up-closed",
  network_error: "offline",
}

/** Maps a thrown value (Clerk API error, network error…) to a screen state. */
export function emailCodeFailure(failure: unknown): EmailCodeFailure {
  if (failure instanceof EmailCodeError) return failure.kind
  if (typeof failure === "object" && failure !== null) {
    const value = failure as {
      errors?: unknown
      code?: unknown
      status?: unknown
    }
    const codes = [
      ...(Array.isArray(value.errors)
        ? value.errors.map((error: unknown) =>
            typeof error === "object" && error !== null
              ? (error as { code?: unknown }).code
              : undefined,
          )
        : []),
      value.code,
    ].filter((code): code is string => typeof code === "string")
    for (const code of codes) {
      const known = failureByCode[code]
      if (known) return known
    }
    if (value.status === 429) return "too-many"
  }
  const message = failure instanceof Error ? failure.message : ""
  if (/offline|network|fetch|hors ligne|internet/i.test(message))
    return "offline"
  return "unknown"
}

const messages: Record<EmailCodeFailure, string> = {
  "invalid-email": "Cette adresse e-mail ne semble pas valide. Vérifie-la.",
  "wrong-code": "Ce code n’est pas le bon. Vérifie le dernier e-mail reçu.",
  expired: "Ce code a expiré. Demande-en un nouveau.",
  "too-many":
    "Trop d’essais pour le moment. Patiente quelques minutes, puis réessaie.",
  offline: "La connexion a été interrompue. Vérifie le réseau, puis réessaie.",
  "sign-up-closed":
    "Aucun compte n’existe avec cette adresse, et la création de compte par e-mail n’est pas encore ouverte. Utilise un autre moyen ci-dessus.",
  "extra-step":
    "La connexion demande une étape qui n’est pas encore prise en charge dans l’app. Essaie un autre moyen ou réessaie plus tard.",
  unknown: "La connexion n’a pas abouti. Réessaie dans un instant.",
}

export function emailCodeMessage(failure: EmailCodeFailure) {
  return messages[failure]
}
