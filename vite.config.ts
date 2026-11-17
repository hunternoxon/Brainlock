import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5280, strictPort: true, host: true },
  preview: { port: 5281, strictPort: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
