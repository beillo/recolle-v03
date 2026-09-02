import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The dataset lives at the repo root in data/, outside this app.
      // Allow the dev server to read it so there is one copy, not two.
      allow: ['..'],
    },
  },
})
