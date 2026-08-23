import { useEffect, useRef } from 'react'
import type { SettingsOnboardingOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface ConversationDirectoryRequestSource {
  getSnapshot(): 'conversation-directory' | undefined
  subscribe(listener: () => void): () => void
}

export interface ConversationDirectoryOnboardingInjected {
  acknowledge(): void
}

/** 仅在缺少根目录的提交明确请求时挂载设置引导项。 */
export function createConversationDirectoryOnboardingRegistration(deps: {
  request: ConversationDirectoryRequestSource
  register(): () => void
}): () => void {
  let unregister: (() => void) | undefined

  const sync = (): void => {
    const requested = deps.request.getSnapshot() === 'conversation-directory'
    if (requested && unregister === undefined) {
      unregister = deps.register()
      return
    }
    if (!requested && unregister !== undefined) {
      const dispose = unregister
      unregister = undefined
      dispose()
    }
  }

  const unsubscribe = deps.request.subscribe(sync)
  sync()
  return () => {
    unsubscribe()
    unregister?.()
    unregister = undefined
  }
}

/** 通过 DSH 公开的引导 owner 打开插件设置分区，然后结束本次引导请求。 */
export function ConversationDirectoryOnboarding(
  props: SettingsOnboardingOwnerProps & ConversationDirectoryOnboardingInjected,
): null {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    props.openSection('conversation-directory')
    props.complete()
    props.acknowledge()
  }, [props.acknowledge, props.complete, props.openSection])

  return null
}
