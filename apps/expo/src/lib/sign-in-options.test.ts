import { describe, expect, it } from "vitest"

import {
  attemptSignIn,
  clerkSignInSettings,
  signInError,
  signInMethods,
  signInMethodsCaption,
  webSignInCopy,
} from "./sign-in-options"

// Shape of Clerk's `userSettings` resource, values as read on the DEV
// instance (Google only, e-mail code, password required at sign-up).
const devUserSettings = {
  social: {
    oauth_google: {
      enabled: true,
      authenticatable: true,
      strategy: "oauth_google",
    },
  },
  attributes: {
    email_address: {
      enabled: true,
      required: true,
      used_for_first_factor: true,
      first_factors: ["email_code"],
    },
    password: {
      enabled: true,
      required: true,
      used_for_first_factor: false,
      first_factors: [],
    },
    ticket: { enabled: true, required: false },
  },
  signUp: { mode: "public" },
}
const withApple = {
  ...devUserSettings,
  social: {
    ...devUserSettings.social,
    oauth_apple: {
      enabled: true,
      authenticatable: true,
      strategy: "oauth_apple",
    },
  },
}
const passwordOptional = {
  ...withApple,
  attributes: {
    ...devUserSettings.attributes,
    password: { enabled: true, required: false },
  },
}

describe("clerkSignInSettings", () => {
  it("reads the DEV instance: Google, e-mail code, no sign-up by code", () => {
    expect(clerkSignInSettings(devUserSettings)).toEqual({
      socialStrategies: ["oauth_google"],
      emailCode: true,
      emailSignUp: false,
    })
  })
  it("lets the code create the account once nothing else is required", () => {
    expect(clerkSignInSettings(passwordOptional)?.emailSignUp).toBe(true)
    expect(
      clerkSignInSettings({
        ...passwordOptional,
        signUp: { mode: "restricted" },
      })?.emailSignUp,
    ).toBe(false)
  })
  it("ignores disabled or non-authenticatable providers", () => {
    const settings = clerkSignInSettings({
      ...devUserSettings,
      social: {
        oauth_google: { enabled: false, strategy: "oauth_google" },
        oauth_apple: {
          enabled: true,
          authenticatable: false,
          strategy: "oauth_apple",
        },
      },
    })
    expect(settings?.socialStrategies).toEqual([])
  })
  it("refuses the e-mail when it is not a code first factor", () => {
    const settings = clerkSignInSettings({
      ...devUserSettings,
      attributes: {
        email_address: {
          enabled: true,
          used_for_first_factor: true,
          first_factors: ["email_link"],
        },
      },
    })
    expect(settings?.emailCode).toBe(false)
    expect(settings?.emailSignUp).toBe(false)
  })
  it("returns null while the environment is not loaded", () => {
    expect(clerkSignInSettings(undefined)).toBeNull()
    expect(clerkSignInSettings({ social: {} })).toBeNull()
  })
})

describe("signInMethods", () => {
  const labels = (settings: unknown, platform: string) =>
    signInMethods(clerkSignInSettings(settings), platform).map(
      (method) => method.label,
    )
  it("shows Apple only once Clerk enables it", () => {
    expect(labels(devUserSettings, "ios")).toEqual([
      "Continuer avec Google",
      "Continuer avec ton e-mail",
    ])
  })
  it("puts Apple first on iOS, Google first elsewhere, e-mail last", () => {
    expect(labels(withApple, "ios")).toEqual([
      "Continuer avec Apple",
      "Continuer avec Google",
      "Continuer avec ton e-mail",
    ])
    expect(labels(withApple, "android")).toEqual([
      "Continuer avec Google",
      "Continuer avec Apple",
      "Continuer avec ton e-mail",
    ])
  })
  it("never offers an unsupported provider", () => {
    const settings = clerkSignInSettings({
      ...devUserSettings,
      social: {
        oauth_github: {
          enabled: true,
          authenticatable: true,
          strategy: "oauth_github",
        },
      },
    })
    expect(signInMethods(settings, "ios")).toEqual([
      { kind: "email", label: "Continuer avec ton e-mail" },
    ])
  })
  it("falls back to Google alone without Clerk settings", () => {
    expect(signInMethods(null, "ios")).toEqual([
      {
        kind: "social",
        strategy: "oauth_google",
        label: "Continuer avec Google",
      },
    ])
  })
})

describe("signInMethodsCaption", () => {
  const caption = (settings: unknown) => {
    const parsed = clerkSignInSettings(settings)
    return signInMethodsCaption(
      signInMethods(parsed, "ios"),
      parsed?.emailSignUp ?? false,
    )
  }
  it("names only what is shown and where the account is created", () => {
    expect(caption(devUserSettings)).toBe(
      "Connexion avec Google ou un code reçu par e-mail, sans mot de passe. Pour créer ton compte, passe par Google ; rien n’est publié sans ton geste.",
    )
    expect(caption(passwordOptional)).toBe(
      "Connexion avec Apple, Google ou un code reçu par e-mail, sans mot de passe. Ton compte est créé à ta première connexion ; rien n’est publié sans ton geste.",
    )
  })
  it("says when nothing is available", () => {
    expect(signInMethodsCaption([], false)).toMatch(/pas disponible/)
  })
})

describe("webSignInCopy", () => {
  it("lists Apple, Google and the passwordless link for the web flow", () => {
    expect(webSignInCopy.methods).toMatch(/Apple/)
    expect(webSignInCopy.methods).toMatch(/sans mot de passe/)
    expect(webSignInCopy.cancelled).toMatch(/lien par e-mail/)
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
