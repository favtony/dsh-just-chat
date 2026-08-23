import type { PendingDraftState } from './stores/pending-draft-store.ts'

interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

interface SessionSelection {
  current: string | undefined
}

export interface ComposerTakeover {
  /** 交接完成后撤销当前覆盖；后续重新进入无会话状态时仍可再次注册。 */
  release(): void
  /** 随插件或 slot 声明一起停止订阅并撤销覆盖。 */
  dispose(): void
}

/**
 * 只在存在待选草稿且当前没有会话时安装临时输入栏。
 *
 * 当前会话出现后不在订阅回调里抢先撤销：组件还需要取得该会话的
 * InputActions 完成草稿交接。交接组件明确调用 release 后，默认输入栏
 * 才重新成为 single slot 的活动项。
 */
export function createComposerTakeover(deps: {
  pending: ObservableSnapshot<PendingDraftState>
  sessions: ObservableSnapshot<SessionSelection>
  register(): () => void
}): ComposerTakeover {
  let disposed = false
  let unregister: (() => void) | undefined

  const release = (): void => {
    const current = unregister
    unregister = undefined
    current?.()
  }

  const reconcile = (): void => {
    if (disposed) return
    const noSession = deps.sessions.getSnapshot().current === undefined
    const hasPendingMode = deps.pending.getSnapshot().mode !== 'none'
    if (noSession && hasPendingMode) {
      unregister ??= deps.register()
      return
    }
    if (noSession) release()
  }

  const unsubscribePending = deps.pending.subscribe(reconcile)
  const unsubscribeSessions = deps.sessions.subscribe(reconcile)
  try {
    reconcile()
  } catch (error) {
    unsubscribeSessions()
    unsubscribePending()
    release()
    throw error
  }

  return {
    release,
    dispose: () => {
      if (disposed) return
      disposed = true
      unsubscribeSessions()
      unsubscribePending()
      release()
    },
  }
}
