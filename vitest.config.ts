import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-runtime/client': fileURLToPath(new URL('./tests/support/runtime-client.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.mjs', 'tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
