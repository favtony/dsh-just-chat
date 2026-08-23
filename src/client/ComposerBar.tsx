import type React from 'react'
import { useEffect, useState } from 'react'
import type { PropsHooks } from '@deepseek-ai/dsh-client-ui-slots'
import { ConversationHandoff } from './ConversationHandoff.tsx'
import type { ComposerBarOwnerProps, ComposerInjected, PendingMode, SubmissionPhase } from './types.ts'

const ACTIVE_SUBMISSION_PHASES: ReadonlySet<SubmissionPhase> = new Set([
  'preparing', 'creatingSession', 'activating', 'waitingPreset', 'handingOff',
])

export function isComposerDisabled(input: {
  ownerDisabled: boolean
  blocked: boolean
  busy: boolean
  submission: SubmissionPhase
  mode: PendingMode
  realSession: boolean
}): boolean {
  const justChatEditor = !input.realSession && input.mode === 'just-chat'
  return input.blocked
    || input.busy
    || ACTIVE_SUBMISSION_PHASES.has(input.submission)
    || (input.ownerDisabled && !justChatEditor)
}

/**
 * Minimal public-input composer. It keeps the official session action face
 * intact and adds only the no-session just-chat preparation branch.
 */
export function ComposerBar(props: ComposerBarOwnerProps & Omit<ComposerInjected, 'hooks'> & PropsHooks<ComposerInjected['hooks']>): React.ReactElement {
  const currentInput = props.useInput?.(state => state.draft) ?? undefined
  const pending = props.usePendingDraft(state => state)
  const view = props.useView(state => state)
  const [draft, setDraft] = useState(currentInput ?? pending.draft)
  const [busy, setBusy] = useState(false)
  const realSession = props.inputActions !== undefined && props.sessionId !== undefined

  useEffect(() => {
    if (!realSession || props.sessionId === undefined) {
      if (currentInput !== undefined) setDraft(currentInput)
      return
    }
    if (pending.mode === 'workspace') {
      try {
        props.inputActions?.setDraft(pending.draft)
        setDraft(pending.draft)
        props.completePendingHandoff()
        props.releaseComposer()
      } catch {
        // 保留持久化草稿和临时输入栏，等待用户重新选择或重试。
      }
      return
    }
    if (props.controller.ownsSession(props.sessionId)) return
    if (currentInput !== undefined) setDraft(currentInput)
    props.releaseComposer()
  }, [
    currentInput,
    pending.draft,
    pending.mode,
    props.completePendingHandoff,
    props.controller,
    props.inputActions,
    props.releaseComposer,
    props.sessionId,
    realSession,
  ])
  const disabled = isComposerDisabled({
    ownerDisabled: props.disabled === true,
    blocked: props.blocked !== undefined,
    busy,
    submission: view.submission,
    mode: pending.mode,
    realSession,
  })
  const pendingEditor = !realSession && pending.mode === 'just-chat'
  const submit = (): void => {
    if (disabled) return
    if (realSession) {
      props.inputActions?.setDraft(draft)
      props.inputActions?.submit()
      return
    }
    if (pending.mode !== 'just-chat' || draft.trim() === '') {
      props.onRequestWorkspace?.()
      return
    }
    setBusy(true)
    void props.startPreparation(draft).finally(() => { setBusy(false) })
  }

  return (
    <section aria-label="消息输入" data-variant={props.variant}>
      {props.accessory}
      <textarea
        value={draft}
        disabled={disabled}
        placeholder={props.blocked?.reason ?? (pendingEditor ? '输入消息' : props.placeholder ?? '输入消息')}
        onChange={event => {
          const text = event.currentTarget.value
          setDraft(text)
          if (!realSession) props.updatePendingDraft(text)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div>
        {props.leftItems}
        <button type="button" disabled={disabled || draft.trim() === ''} onClick={submit}>发送</button>
        {props.rightItems}
      </div>
      {props.footer}
      {view.error !== undefined && <p role="alert">{view.error.message}</p>}
      <ConversationHandoff
        sessionId={props.sessionId}
        inputActions={props.inputActions}
        controller={props.controller}
        ready={view.submission === 'handingOff'}
        onComplete={props.releaseComposer}
      />
    </section>
  )
}
