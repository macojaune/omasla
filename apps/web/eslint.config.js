import baseConfig, { restrictEnvAccess } from "@omasla/eslint-config/base"
import reactConfig from "@omasla/eslint-config/react"

/** @type {import('typescript-eslint').Config} */
export default [
  { ignores: ["src/routeTree.gen.ts"] },
  ...baseConfig,
  ...reactConfig,
  ...restrictEnvAccess,
]
