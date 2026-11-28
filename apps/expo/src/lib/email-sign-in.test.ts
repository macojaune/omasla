import { describe, expect, it } from "vitest"

import {
  EmailCodeError,
  emailCodeFailure,
  emailCodeMessage,
  isCompleteCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
  resendCountdown,
  resendDelaySeconds,
} from "./email-sign-in"

describe("e-mail address", () => {
  it("accepts a usual address, trimmed", () => {
    expect(normalizeEmail("  zoe@exemple.fr ")).toBe("zoe@exemple.fr")
    expect(isValidEmail(" zoe.martin+carnaval@mail.exemple.gp ")).toBe(true)
  })
  it("rejects what cannot receive a code", () => {
    for (const value of [
      "",
      "zoe",
      "zoe@",
      "@exemple.fr",
      "zoe@exemple",
      "zo e@exemple.fr",
      "zoe@exemple.f",
    ])
      expect(isValidEmail(value)).toBe(false)
  })
})

describe("code", () => {
  it("keeps the six digits of a pasted code", () => {
    expect(normalizeCode("123 456")).toBe("123456")
    expect(normalizeCode("Code : 123-4567")).toBe("123456")
  })
  it("is complete at exactly six digits", () => {
    expect(isCompleteCode("123456")).toBe(true)
    expect(isCompleteCode("12345")).toBe(false)
    expect(isCompleteCode("12345a")).toBe(false)
  })
})

describe("resendCountdown", () => {
  it("counts down from the last sending, then allows a new code", () => {
    expect(resendCountdown(0, 0)).toBe(resendDelaySeconds)
    expect(resendCountdown(0, 10_500)).toBe(resendDelaySeconds - 10)
    expect(resendCountdown(0, resendDelaySeconds * 1000)).toBe(0)
    expect(resendCountdown(0, 90_000)).toBe(0)
  })
  it("never exceeds the delay if the clock goes back", () => {
    expect(resendCountdown(10_000, 0)).toBe(resendDelaySeconds)
  })
})

describe("emailCodeFailure", () => {
  const clerkError = (code: string, status = 422) => ({
    status,
    errors: [{ code, message: "provider text" }],
  })
  it("maps Clerk codes to screen states", () => {
    expect(emailCodeFailure(clerkError("form_code_incorrect"))).toBe(
      "wrong-code",
    )
    expect(emailCodeFailure(clerkError("verification_expired"))).toBe("expired")
    expect(emailCodeFailure(clerkError("verification_failed"))).toBe("too-many")
    expect(emailCodeFailure(clerkError("form_param_format_invalid"))).toBe(
      "invalid-email",
    )
    expect(emailCodeFailure(clerkError("anything", 429))).toBe("too-many")
    expect(emailCodeFailure({ code: "network_error" })).toBe("offline")
  })
  it("recognises a network failure and the app's own outcomes", () => {
    expect(emailCodeFailure(new TypeError("Network request failed"))).toBe(
      "offline",
    )
    expect(emailCodeFailure(new EmailCodeError("sign-up-closed"))).toBe(
      "sign-up-closed",
    )
  })
  it("never shows a provider message", () => {
    const kind = emailCodeFailure(clerkError("clerk_internal_xyz"))
    expect(kind).toBe("unknown")
    expect(emailCodeMessage(kind)).not.toMatch(/provider|clerk/i)
  })
  it("speaks plainly, with tutoiement", () => {
    expect(emailCodeMessage("wrong-code")).toMatch(/Vérifie/)
    expect(emailCodeMessage("sign-up-closed")).toMatch(/autre moyen/)
  })
})
