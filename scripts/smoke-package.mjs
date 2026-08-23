import { access } from 'node:fs/promises'

await Promise.all([
  access(new URL('../lib/index.mjs', import.meta.url)),
  access(new URL('../lib/client.js', import.meta.url)),
])
