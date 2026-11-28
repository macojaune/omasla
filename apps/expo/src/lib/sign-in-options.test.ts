import { describe, expect, it } from "vitest"

import { attemptSignIn, signInCopy, signInError } from "./sign-in-options"

describe("signInCopy", () => {
  it("promises only Google in the Clerk build", () => {
    const copy = signInCopy("clerk")
    expect(copy.button).toBe("Continuer avec Google")
    expect(copy.methods).not.toMatch(/Apple|e-mail/)
  })
  it("lists Apple, Google and the passwordless link for the web flow", () => {
    const copy = signInCopy("web")
    expect(copy.methods).toMatch(/Apple/)
    expect(copy.methods).toMatch(/sans mot de passe/)
    expect(copy.cancelled).toMatch(/lien par e-mail/)
  })
})

describe("attemptSignIn", () => {
  it("reports a session", async () => {
    expect(await attemptSignIn(() => Promise.resolve(true))).toEqual({
      kind: "signed-in",
    })
  })
  it("treats a closed window as a cancellation, not an error", async () => {
    expect(await attemptSignIn(() => Promise.resolve(false))).toEqual({
      kind: "cancelled",
    })
  })
  it("turns a thrown failure into a readable message", async () => {
    const outcome = await attemptSignIn(() =>
      Promise.reject(new Error("Network request failed")),
    )
    expect(outcome).toEqual({
      kind: "failed",
      message:
        "La connexion a été interrompue. Vérifie le réseau, puis réessaie.",
    })
  })
})

describe("signInError", () => {
  it("never shows a provider code", () => {
    expect(signInError(new Error("clerk_oauth_xyz"))).toBe(
      "La connexion n’a pas abouti. Réessaie dans un instant.",
    )
    expect(signInError("nope")).toBe(
      "La connexion n’a pas abouti. Réessaie dans un instant.",
    )
  })
  it("explains an extra Clerk step and an expired return", () => {
    expect(
      signInError(new Error("La connexion requiert une étape supplémentaire.")),
    ).toMatch(/étape/)
    expect(
      signInError(
        new Error("Cette connexion a expiré. Recommence la connexion."),
      ),
    ).toMatch(/expiré/)
  })
})
