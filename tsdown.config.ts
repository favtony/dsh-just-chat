import { defineConfig } from 'tsdown'

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
] as const

const NODE_EXTERNALS = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-session-persistence',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-storage-domain',
  'react',
  'react-dom',
]

const browserClient = {
  name: 'dsh-just-chat/client',
  entry: { client: 'src/client/index.ts' },
  dts: false,
  format: 'cjs' as const,
  platform: 'browser' as const,
  outDir: 'lib',
  clean: false,
  sourcemap: true,
  external: [...CLIENT_EXTERNALS],
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id as (typeof CLIENT_EXTERNALS)[number]) ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: \"dsh-just-chat\", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'client/index': 'src/client/index.ts',
    },
    dts: false,
    format: 'esm',
    outDir: 'lib',
    clean: false,
    external: NODE_EXTERNALS,
  },
  browserClient,
])
