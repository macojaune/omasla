import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { setTimeout } from "node:timers/promises"
import { fileURLToPath } from "node:url"

const existingOrigin = process.argv[2]
const smokeIssuer = "https://omasla-smoke.invalid"
const port = process.env.SMOKE_WEB_PORT ?? "3185"
const origin = existingOrigin ?? `http://127.0.0.1:${port}`
const webDirectory = fileURLToPath(new URL("../apps/web/", import.meta.url))
const server = existingOrigin
  ? undefined
  : spawn(
      process.execPath,
      ["--env-file=../../.env", ".output/server/index.mjs"],
      {
        cwd: webDirectory,
        env: {
          ...process.env,
          NODE_ENV: "production",
          HOST: "127.0.0.1",
          PORT: port,
          // Keep HTTPS issuer validation active in the production bundle on loopback.
          AUTH_URL: smokeIssuer,
          AUTH_ISSUER_URL: smokeIssuer,
        },
        stdio: "inherit",
      },
    )

async function request(path, expectedStatus, init) {
  const response = await fetch(new URL(path, origin), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  })
  assert.equal(response.status, expectedStatus, path)
  console.log(`${response.status} ${path}`)
  return response
}

try {
  for (let attempt = 0; server && attempt < 20; attempt++) {
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1_000),
      })
      await response.body?.cancel()
      break
    } catch (error) {
      if (server.exitCode !== null || attempt === 19) throw error
      await setTimeout(250)
    }
  }

  for (const path of [
    "/",
    "/map",
    "/login",
    "/admin",
    "/mentions-legales",
    "/politique-de-confidentialite",
  ]) {
    const page = await request(path, 200)
    assert.match(page.headers.get("content-type") ?? "", /^text\/html/, path)
    if (path === "/admin") assert.match(await page.text(), /Connexion requise/)
    else await page.body?.cancel()
  }
  await request("/page-introuvable-qa", 404)
  const providers = await request("/api/auth/providers", 200)
  assert.equal(
    providers.headers.get("content-type")?.split(";")[0],
    "application/json",
  )
  await request("/api/auth/session", 200)
  const jwks = await request("/api/auth/jwks", 200)
  assert.ok((await jwks.json()).keys.length > 0)

  const jsonPost = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }
  await request("/api/auth/convex-token", 403, jsonPost)
  await request("/api/auth/convex-token", 401, {
    ...jsonPost,
    headers: {
      ...jsonPost.headers,
      Origin: existingOrigin ? new URL(origin).origin : smokeIssuer,
    },
  })
  await request("/api/auth/native/exchange", 400, jsonPost)
  await request("/api/auth/native/logout", 401, jsonPost)
  await request("/api/trpc/auth.getSession", 200)
  await request("/api/trpc/auth.getSecretMessage", 401)
} finally {
  server?.kill()
}
