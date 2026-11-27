import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  envPrefix: "NEXT_PUBLIC_",
  resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
  server: { port: 3185, strictPort: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }),
    react(),
  ],
})
