import { useEffect } from 'react'
import type { InputActions, SessionId } from './types.ts'
import type { SubmissionController } from './handoff.ts'

/**
 * Runs only in a real session-maybe scope. The component never talks to RPC;
 * the official InputActions path owns durable submission and logging.
 */
export function ConversationHandoff(props: {
  sessionId: SessionId | undefined
  inputActions: InputActions | undefined
  controller: SubmissionController
  ready: boolean
  onComplete(): void
}): null {
  useEffect(() => {
    if (!props.ready || props.sessionId === undefined || props.inputActions === undefined) return
    const text = props.controller.takeHandoff(props.sessionId)
    if (text === undefined) return
    try {
      props.inputActions.setDraft(text)
      props.inputActions.submit()
      props.controller.completeHandoff(props.sessionId)
    } catch (error) {
      props.controller.failHandoff(props.sessionId, error)
      return
    }
    props.onComplete()
  }, [props.controller, props.inputActions, props.onComplete, props.ready, props.sessionId])
  return null
}
