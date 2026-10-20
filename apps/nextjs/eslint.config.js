import baseConfig, { restrictEnvAccess } from "@omasla/eslint-config/base"
import nextjsConfig from "@omasla/eslint-config/nextjs"
import reactConfig from "@omasla/eslint-config/react"

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
]
