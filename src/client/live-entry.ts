import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'

type SlotName = 'conversation' | 'conversation.hero.workspace' | 'conversation.composer.bar' | 'sidebar.workspaces'

type SlotRegistry = {
  entries(name: SlotName): readonly StoredEntry[]
}

export type LiveComponent<P> = (props: P) => unknown

export interface LiveEntryContract {
  locale: string
  children: readonly { name: string; kind: string; scope: string }[]
}

function requireEntry(registry: SlotRegistry, name: SlotName, contract: LiveEntryContract): StoredEntry {
  const entries = registry.entries(name)
  if (entries.length !== 1) {
    throw new Error(`dsh-just-chat requires exactly one official live entry for "${name}", found ${entries.length}`)
  }
  const entry = entries[0]
  if (typeof entry.component !== 'function') {
    throw new Error(`dsh-just-chat official live entry "${name}" has no callable component`)
  }
  if (entry.inject === undefined || typeof entry.inject !== 'function') {
    throw new Error(`dsh-just-chat official live entry "${name}" has no inject factory`)
  }
  if (entry.locale !== contract.locale) {
    throw new Error(`dsh-just-chat official live entry "${name}" has locale "${entry.locale ?? ''}", expected "${contract.locale}"`)
  }
  for (const child of contract.children) {
    const actual = entry.children?.[child.name]
    if (actual?.kind !== child.kind || actual.scope !== child.scope) {
      throw new Error(`dsh-just-chat official live entry "${name}" has incompatible child "${child.name}"`)
    }
  }
  return entry
}

/** Replace only the component pointer of the host's current live entry. */
export function installLiveEntry<P>(
  registry: SlotRegistry,
  name: SlotName,
  contract: LiveEntryContract,
  createAdapter: (official: LiveComponent<P>) => LiveComponent<P>,
): () => void {
  const entry = requireEntry(registry, name, contract)
  const official = entry.component as LiveComponent<P>
  const adapter = createAdapter(official)
  if (typeof adapter !== 'function') throw new Error(`dsh-just-chat adapter for "${name}" is not callable`)
  entry.component = adapter
  return () => {
    if (entry.component !== adapter) {
      throw new Error(`dsh-just-chat official live entry "${name}" changed while adapted`)
    }
    entry.component = official
  }
}

export const OFFICIAL_ENTRY_CONTRACTS = {
  conversation: {
    locale: 'conversation',
    children: [
      { name: 'conversation.session', kind: 'single', scope: 'session' },
      { name: 'conversation.session.header', kind: 'single', scope: 'session' },
      { name: 'conversation.composer', kind: 'chain', scope: 'session' },
      { name: 'conversation.composer.bar', kind: 'single', scope: 'session-maybe' },
      { name: 'conversation.input.overlay', kind: 'list', scope: 'session' },
      { name: 'conversation.input.dock', kind: 'list', scope: 'session' },
      { name: 'conversation.composer.dock', kind: 'list', scope: 'session' },
      { name: 'conversation.input.left', kind: 'list', scope: 'session' },
      { name: 'conversation.input.right', kind: 'list', scope: 'session' },
      { name: 'conversation.hero.brand.mark', kind: 'single', scope: 'root' },
      { name: 'conversation.hero.workspace', kind: 'single', scope: 'root' },
      { name: 'conversation.hero.agentPreset', kind: 'single', scope: 'root' },
    ],
  },
  picker: {
    locale: 'workspace',
    children: [{ name: 'conversation.hero.workspace.directoryFlow', kind: 'single', scope: 'root' }],
  },
  composer: {
    locale: 'conversation',
    children: [
      { name: 'conversation.input.attachments', kind: 'single', scope: 'session-maybe' },
      { name: 'conversation.input.plan', kind: 'single', scope: 'session' },
      { name: 'conversation.input.model', kind: 'single', scope: 'session' },
    ],
  },
  sidebar: {
    locale: 'workspace',
    children: [{ name: 'sidebar.workspaces.directoryFlow', kind: 'single', scope: 'root' }],
  },
} as const satisfies Record<string, LiveEntryContract>
