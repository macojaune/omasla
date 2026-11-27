import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clerkConvexLogout,
  clerkConvexToken,
} from "../../../apps/web/src/auth/clerk.server"

const { verifyToken, getSession, issueAccessToken, revokeConvexSession } =
  vi.hoisted(() => ({
    verifyToken: vi.fn(),
    getSession: vi.fn(),
    issueAccessToken: vi.fn(),
    revokeConvexSession: vi.fn(),
  }))

vi.mock("@clerk/backend", () => ({
  verifyToken,
  createClerkClient: () => ({ sessions: { getSession } }),
}))

vi.mock("@omasla/auth/tokens", () => ({
  issueAccessToken,
  revokeConvexSession,
}))

const origin = "https://omasla-dev.example.test"
const sessionToken = `header.${"a".repeat(400)}.signature`
const bearer = `Bearer ${sessionToken}`
const issuer = "https://omasla.clerk.accounts.dev"
const expires = Date.now() + 60_000
const active = {
  id: "sess_Valid",
  userId: "user_Valid",
  status: "active",
  expireAt: expires,
}

function request(authorization?: string) {
  return new Request(`${origin}/api/auth/convex-token`, {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AUTH_URL", origin)
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_placeholder")
  vi.stubEnv(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    `pk_test_${Buffer.from("omasla.clerk.accounts.dev$").toString("base64")}`,
  )
  verifyToken.mockResolvedValue({
    sub: active.userId,
    sid: active.id,
    iss: issuer,
  })
  getSession.mockResolvedValue(active)
  issueAccessToken.mockResolvedValue({
    token: "signed-token",
    expiresAt: expires,
  })
})

afterEach(() => vi.unstubAllEnvs())

describe("Clerk session exchange", () => {
  it("requires a verified bearer from the configured instance", async () => {
    expect((await clerkConvexToken(request())).status).toBe(401)
    expect(verifyToken).not.toHaveBeenCalled()
    verifyToken.mockRejectedValueOnce(new Error("Invalid signature"))
    expect(
      (await clerkConvexToken(request("Bearer header.invalid.signature")))
        .status,
    ).toBe(401)
    verifyToken.mockResolvedValueOnce({
      sub: active.userId,
      sid: active.id,
      iss: "https://other.clerk.accounts.dev",
    })
    expect(
      (await clerkConvexToken(request("Bearer header.other.signature"))).status,
    ).toBe(401)
    expect(getSession).not.toHaveBeenCalled()
    expect(issueAccessToken).not.toHaveBeenCalled()
  })

  it.each([
    { ...active, id: "sess_Other" },
    { ...active, userId: "user_Other" },
    { ...active, status: "revoked" },
    { ...active, expireAt: 0 },
  ])("rejects mismatched or inactive Clerk sessions", async (session) => {
    getSession.mockResolvedValueOnce(session)
    expect((await clerkConvexToken(request(bearer))).status).toBe(401)
    expect(issueAccessToken).not.toHaveBeenCalled()
  })

  it("rejects a signed token from a different web origin", async () => {
    verifyToken.mockResolvedValueOnce({
      sub: active.userId,
      sid: active.id,
      iss: issuer,
      azp: "https://other.example.test",
    })
    expect((await clerkConvexToken(request(bearer))).status).toBe(401)
    expect(getSession).not.toHaveBeenCalled()
  })

  it.each([undefined, origin])(
    "issues a short lived authorization with azp %s",
    async (azp) => {
      verifyToken.mockResolvedValueOnce({
        sub: active.userId,
        sid: active.id,
        iss: issuer,
        ...(azp ? { azp } : {}),
      })
      const response = await clerkConvexToken(request(bearer))
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(verifyToken).toHaveBeenCalledWith(sessionToken, {
        secretKey: "sk_test_placeholder",
        issuer,
      })
      expect(issueAccessToken).toHaveBeenCalledWith(
        {
          user: { id: "clerk:user_Valid", name: null },
          expires: new Date(expires).toISOString(),
        },
        "clerk:sess_Valid",
      )
    },
  )

  it("waits for Convex revocation before acknowledging logout", async () => {
    revokeConvexSession.mockRejectedValueOnce(new Error("Convex unavailable"))
    await expect(clerkConvexLogout(request(bearer))).rejects.toThrow(
      "Convex unavailable",
    )
    const response = await clerkConvexLogout(request(bearer))
    expect(response.status).toBe(200)
    expect(revokeConvexSession).toHaveBeenLastCalledWith(
      {
        user: { id: "clerk:user_Valid", name: null },
        expires: new Date(expires).toISOString(),
      },
      "clerk:sess_Valid",
    )
  })
})
