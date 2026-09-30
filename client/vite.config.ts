import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Shown in Settings > About. Vercel provides the commit being deployed; local builds say "dev".
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(commit ? `1.0 (${commit})` : 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
