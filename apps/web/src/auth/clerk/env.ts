export function readClerkConfiguration() {
  const secretKey = process.env.CLERK_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!secretKey && !publishableKey) return null

  const key = publishableKey?.match(/^pk_(test|live)_([A-Za-z0-9+/_-]+=*)$/)
  const party = process.env.AUTH_URL
  if (!key || !secretKey?.startsWith(`sk_${key[1]}_`) || !party)
    throw new Error("Incomplete Clerk configuration")

  const frontendHost = Buffer.from(key[2] ?? "", "base64url")
    .toString("utf8")
    .replace(/\$$/, "")
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(frontendHost))
    throw new Error("Invalid Clerk frontend host")
  return { secretKey, issuer: `https://${frontendHost}`, party }
}
