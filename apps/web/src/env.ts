import { z } from "zod"

export const env = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ANALYTICS_ENABLED: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.string(),
}).parse({
  NEXT_PUBLIC_CONVEX_URL: import.meta.env.NEXT_PUBLIC_CONVEX_URL,
  NEXT_PUBLIC_MAPBOX_TOKEN: import.meta.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined,
  NEXT_PUBLIC_APP_URL: import.meta.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_ANALYTICS_ENABLED: import.meta.env.NEXT_PUBLIC_ANALYTICS_ENABLED || undefined,
  NODE_ENV: import.meta.env.MODE,
})
