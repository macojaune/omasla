import type { TextInputInstance } from "react-native"
import { useEffect, useRef, useState } from "react"
import { StyleSheet, TextInput, View } from "react-native"

import type { EmailCodeFlow } from "~/utils/auth"
import {
  codeLength,
  emailCodeFailure,
  emailCodeMessage,
  isCompleteCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
  resendCountdown,
} from "~/lib/email-sign-in"
import { Button, Label, Notice, usePalette } from "~/theme/ui"

type Step =
  | { kind: "address"; busy: boolean }
  | {
      kind: "code"
      address: string
      mode: "sign-in" | "sign-up"
      sentAt: number
      busy: "verify" | "resend" | null
      resent: boolean
    }

/**
 * E-mail sign-in by one-time code: address, then the 6-digit code. The code
 * signs an existing account in, or creates it at the first connection.
 */
export default function EmailCodeForm({
  flow,
  canSend,
  onCancel,
  onSignedIn,
}: {
  flow: EmailCodeFlow
  /** False while offline: nothing is sent, the form stays filled. */
  canSend: boolean
  onCancel: () => void
  onSignedIn: () => void
}) {
  const c = usePalette()
  const [address, setAddress] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<Step>({ kind: "address", busy: false })
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const mounted = useRef(true)
  const codeInput = useRef<TextInputInstance>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const countdown = step.kind === "code" ? resendCountdown(step.sentAt, now) : 0
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  async function send() {
    if (step.kind !== "address" || step.busy) return
    const email = normalizeEmail(address)
    if (!isValidEmail(email)) {
      setError(emailCodeMessage("invalid-email"))
      return
    }
    setError(null)
    setStep({ kind: "address", busy: true })
    try {
      const mode = await flow.send(email)
      if (!mounted.current) return
      const sentAt = Date.now()
      setNow(sentAt)
      setCode("")
      setStep({
        kind: "code",
        address: email,
        mode,
        sentAt,
        busy: null,
        resent: false,
      })
    } catch (failure) {
      if (!mounted.current) return
      setStep({ kind: "address", busy: false })
      setError(emailCodeMessage(emailCodeFailure(failure)))
    }
  }

  async function verify(value: string) {
    if (step.kind !== "code" || step.busy) return
    if (!isCompleteCode(value)) {
      setError(`Saisis les ${codeLength} chiffres du code reçu.`)
      return
    }
    setError(null)
    setStep({ ...step, busy: "verify" })
    try {
      await flow.verify(value)
      onSignedIn()
    } catch (failure) {
      if (!mounted.current) return
      const kind = emailCodeFailure(failure)
      setStep({ ...step, busy: null })
      setError(emailCodeMessage(kind))
      if (kind === "wrong-code") {
        setCode("")
        codeInput.current?.focus()
      }
    }
  }

  async function resend() {
    if (step.kind !== "code" || step.busy || countdown > 0) return
    setError(null)
    setStep({ ...step, busy: "resend", resent: false })
    try {
      await flow.resend()
      if (!mounted.current) return
      const sentAt = Date.now()
      setNow(sentAt)
      setCode("")
      setStep({ ...step, busy: null, sentAt, resent: true })
    } catch (failure) {
      if (!mounted.current) return
      setStep({ ...step, busy: null })
      setError(emailCodeMessage(emailCodeFailure(failure)))
    }
  }

  function changeAddress() {
    flow.cancel()
    setCode("")
    setError(null)
    setStep({ kind: "address", busy: false })
  }

  function cancel() {
    flow.cancel()
    onCancel()
  }

  const field = [
    s.field,
    { backgroundColor: c.background, borderColor: c.line },
  ]
  if (step.kind === "address")
    return (
      <View style={s.form}>
        <Label style={s.heading}>Ton adresse e-mail</Label>
        <Label muted style={s.caption}>
          On t’envoie un code à {codeLength} chiffres. Pas de mot de passe.
        </Label>
        <TextInput
          value={address}
          onChangeText={(value) => {
            setAddress(value)
            if (error) setError(null)
          }}
          onSubmitEditing={() => void send()}
          placeholder="prenom@exemple.fr"
          placeholderTextColor={c.muted}
          accessibilityLabel="Adresse e-mail"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          inputMode="email"
          returnKeyType="send"
          editable={!step.busy}
          autoFocus
          style={[field, { color: c.ink }]}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          title="Recevoir un code"
          busy={step.busy}
          disabled={!canSend || address.trim().length === 0}
          onPress={() => void send()}
        />
        <Button title="Annuler" variant="secondary" onPress={cancel} />
      </View>
    )
  return (
    <View style={s.form}>
      <Label style={s.heading}>Saisis le code reçu</Label>
      <Label muted style={s.caption}>
        Code envoyé à {step.address}.
        {step.mode === "sign-up"
          ? " Il crée ton compte : c’est ta première connexion avec cette adresse."
          : ""}{" "}
        Pense à regarder dans les indésirables.
      </Label>
      <TextInput
        ref={codeInput}
        value={code}
        onChangeText={(value) => {
          const next = normalizeCode(value)
          setCode(next)
          if (error) setError(null)
          // A complete code (typed or filled in from Mail) is checked at once.
          if (isCompleteCode(next) && next !== code) void verify(next)
        }}
        onSubmitEditing={() => void verify(code)}
        placeholder={"0".repeat(codeLength)}
        placeholderTextColor={c.muted}
        accessibilityLabel={`Code à ${codeLength} chiffres`}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={codeLength}
        editable={step.busy !== "verify"}
        autoFocus
        style={[field, s.code, { color: c.ink }]}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {step.resent && !error && (
        <Notice>Nouveau code envoyé. Seul le dernier reçu fonctionne.</Notice>
      )}
      <Button
        title="Valider le code"
        busy={step.busy === "verify"}
        disabled={!canSend || !isCompleteCode(code) || step.busy === "resend"}
        onPress={() => void verify(code)}
      />
      <Button
        title={
          countdown > 0
            ? `Renvoyer le code (${countdown} s)`
            : "Renvoyer le code"
        }
        variant="secondary"
        busy={step.busy === "resend"}
        disabled={!canSend || countdown > 0 || step.busy === "verify"}
        onPress={() => void resend()}
      />
      <Button
        title="Modifier l’adresse"
        variant="secondary"
        disabled={step.busy === "verify"}
        onPress={changeAddress}
      />
    </View>
  )
}

const s = StyleSheet.create({
  form: { gap: 12 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600" },
  caption: { fontSize: 14, lineHeight: 21 },
  field: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  code: { fontSize: 24, letterSpacing: 8, fontVariant: ["tabular-nums"] },
})
