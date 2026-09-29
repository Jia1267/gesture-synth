import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the build works under any sub-path (e.g. GitHub Pages /gesture-synth/).
  base: './',
})
