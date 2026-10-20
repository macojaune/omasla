import baseConfig from "@omasla/eslint-config/base"
import reactConfig from "@omasla/eslint-config/react"

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".expo/**", "expo-plugins/**", "ios/**", "android/**"],
  },
  ...baseConfig,
  ...reactConfig,
]
