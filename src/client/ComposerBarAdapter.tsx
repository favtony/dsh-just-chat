import { createElement, Fragment, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type React from 'react'
import type { ComposerBarInjected } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PendingDraftState } from './stores/pending-draft-store.ts'
import type { ViewState } from './stores/view-store.ts'
import type { SubmissionController } from './handoff.ts'
import { ConversationHandoff } from './ConversationHandoff.tsx'
import type { LiveComponent } from './live-entry.ts'
import type { ComposerBarProps, InputActions, InputState } from './types.ts'

type ComposerKeyboard = NonNullable<ComposerBarInjected['keyboard']>

export interface ComposerBarAdapterDeps {
  pending: SnapshotStore<PendingDraftState>
  view: SnapshotStore<ViewState>
  controller: SubmissionController
  updatePendingDraft(draft: string): void
  completePendingHandoff(): void
  startPreparation(text: string): Promise<void>
}

const ACTIVE_PHASES = new Set(['preparing', 'creatingSession', 'activating', 'waitingPreset', 'handingOff'])

function pendingInput(draft: string, busy: boolean, draftRev: number): InputState {
  return {
    draft,
    imageIds: [],
    draftRev,
    phase: busy ? 'submitting' : 'plain',
    occurrences: [],
    queue: [],
  }
}

/** Official InputBar with only the pending just-chat text adapter. */
export function createComposerBarAdapter(
  deps: ComposerBarAdapterDeps,
): (official: LiveComponent<ComposerBarProps>) => LiveComponent<ComposerBarProps> {
  return official => function ComposerBarAdapter(props): React.ReactElement {
    const pending = useSyncExternalStore(
      listener => deps.pending.subscribe(listener),
      () => deps.pending.getSnapshot(),
      () => deps.pending.getSnapshot(),
    )
    const view = useSyncExternalStore(
      listener => deps.view.subscribe(listener),
      () => deps.view.getSnapshot(),
      () => deps.view.getSnapshot(),
    )
    const sessionBlank = props.useSession(state => state.blank) ?? false
    const ownedSession = props.sessionId !== undefined && deps.controller.ownsSession(props.sessionId)
    const justChat = pending.mode === 'just-chat'
      && !ownedSession
      && (props.sessionId === undefined || sessionBlank)
    const busy = ACTIVE_PHASES.has(view.submission)
    const revision = useRef({ draft: pending.draft, value: 0 })
    if (revision.current.draft !== pending.draft) {
      revision.current = { draft: pending.draft, value: revision.current.value + 1 }
    }
    const state = useMemo(() => pendingInput(pending.draft, busy, revision.current.value), [busy, pending.draft, revision.current.value])
    const useInput = <S,>(selector: (input: InputState) => S): S => {
      // Preserve the official selector hook while replacing only its snapshot.
      props.useInput(current => current)
      return selector(state)
    }
    const start = useCallback((): void => {
      if (!justChat || state.draft.trim() === '' || busy) return
      void deps.startPreparation(state.draft)
    }, [busy, deps.startPreparation, justChat, state.draft])
    const inputActions = useMemo<InputActions>(() => ({
      setDraft: draft => deps.updatePendingDraft(draft),
      addImages: () => false,
      removeImage: () => {},
      pruneImages: () => {},
      submit: start,
    }), [deps.updatePendingDraft, start])
    const keyboard = useMemo<ComposerKeyboard>(() => ({
      get snapshot() { return state },
      setDraft: draft => deps.updatePendingDraft(draft),
      submit: start,
      steerQueue: () => {},
      undo: () => {},
      redo: () => {},
      pasteBegin: (text, selection) => {
        deps.updatePendingDraft(state.draft.slice(0, selection.start) + text + state.draft.slice(selection.end))
      },
      invalidatePaste: () => {},
      track: () => {},
      arbitrate: () => 'pass',
      space: () => false,
      dismissPopup: () => {},
    }), [deps.updatePendingDraft, start, state])

    useEffect(() => {
      if (props.sessionId === undefined || props.inputActions === undefined || pending.mode !== 'workspace') return
      props.inputActions.setDraft(pending.draft)
      deps.completePendingHandoff()
    }, [deps.completePendingHandoff, pending.draft, pending.mode, props.inputActions, props.sessionId])

    const adapted = justChat
      ? {
          ...props,
          disabled: false,
          useInput,
          inputActions,
          keyboard,
        }
      : props
    const body = createElement(official as React.ComponentType<ComposerBarProps>, adapted)
    const handoff = props.sessionId === undefined || props.inputActions === undefined
      ? null
      : createElement(ConversationHandoff, {
          sessionId: props.sessionId,
          inputActions: props.inputActions,
          controller: deps.controller,
          ready: view.submission === 'handingOff',
          onComplete: () => {},
        })
    return createElement(Fragment, null, body, handoff)
  }
}
