import { Component, type ErrorInfo, type ReactElement, type ReactNode, type RefObject, useEffect } from 'react'

export const SIDEBAR_SECTION_STYLE = {
  display: 'block',
  flex: 'none',
  minHeight: 0,
} as const

const SIDEBAR_CSS_ID = 'dsh-just-chat/sidebar-layout'
const SIDEBAR_CSS = [
  '[data-dsh-just-chat-sidebar="true"] > [data-dsh-just-chat-section] {',
  '  display: block !important;',
  '  flex: none !important;',
  '  min-height: max-content !important;',
  '}',
  '[data-dsh-just-chat-sidebar="true"] > [data-dsh-just-chat-section] > div,',
  '[data-dsh-just-chat-sidebar="true"] > [data-dsh-just-chat-section] > div > div:has([role="tree"]),',
  '[data-dsh-just-chat-sidebar="true"] > [data-dsh-just-chat-section] > div > div > div:has([role="tree"]),',
  '[data-dsh-just-chat-sidebar="true"] div:has(> [role="tree"]),',
  '[data-dsh-just-chat-sidebar="true"] [role="tree"] {',
  '  flex: none !important;',
  '  height: auto !important;',
  '  min-height: max-content !important;',
  '}',
  '[data-dsh-just-chat-sidebar="true"] div:has(> [role="tree"]),',
  '[data-dsh-just-chat-sidebar="true"] [role="tree"] {',
  '  flex: none !important;',
  '  height: auto !important;',
  '  min-height: max-content !important;',
  '  overflow-y: visible !important;',
  '}',
].join('\n')

function hasArea(element: Element | null): element is HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(element instanceof HTMLElement)) return false
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/** Return false when the expanded workspace browser has collapsed geometry. */
export function isExpandedSidebarLayoutUsable(root: HTMLElement): boolean {
  if (!hasArea(root)) return false
  const workspaceSection = root.querySelector<HTMLElement>('[data-dsh-just-chat-section="workspaces"]')
  if (!hasArea(workspaceSection)) return false
  const browser = workspaceSection.firstElementChild
  if (!hasArea(browser)) return false
  return hasArea(workspaceSection.querySelector('[role="tree"]'))
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof window === 'undefined') return 0
  return typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(Date.now()), 0)
}

function cancelFrame(handle: number): void {
  if (typeof window === 'undefined' || handle === 0) return
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(handle)
  else window.clearTimeout(handle)
}

export interface SidebarLayoutGuardProps {
  wide: boolean
  rootRef: RefObject<HTMLDivElement | null>
  onInvalid: () => void
  children?: ReactNode
}

/** Inject scoped layout CSS and disable the plugin after repeated bad geometry. */
export function SidebarLayoutGuard({ wide, rootRef, onInvalid, children }: SidebarLayoutGuardProps): ReactElement {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const existing = document.querySelector<HTMLStyleElement>(
      `style[data-dsh-just-chat-css="${SIDEBAR_CSS_ID}"]`,
    )
    if (existing !== null) return
    const style = document.createElement('style')
    style.dataset.dshJustChatCss = SIDEBAR_CSS_ID
    style.textContent = SIDEBAR_CSS
    document.head.appendChild(style)
    return () => {
      if (style.parentNode !== null) style.parentNode.removeChild(style)
    }
  }, [])

  useEffect(() => {
    if (!wide || typeof window === 'undefined') return
    let disposed = false
    let failures = 0
    let firstFrame = 0
    let secondFrame = 0
    let scheduledFrame = 0

    const check = (): void => {
      if (disposed) return
      const root = rootRef.current
      if (root !== null && isExpandedSidebarLayoutUsable(root)) {
        failures = 0
        return
      }
      failures += 1
      if (failures >= 3) {
        onInvalid()
        return
      }
      scheduledFrame = requestFrame(() => {
        scheduledFrame = 0
        check()
      })
    }

    const scheduleCheck = (): void => {
      if (disposed || scheduledFrame !== 0) return
      scheduledFrame = requestFrame(() => {
        scheduledFrame = 0
        check()
      })
    }

    firstFrame = requestFrame(() => {
      secondFrame = requestFrame(() => check())
    })

    const ResizeObserverConstructor = window.ResizeObserver
    const observer = typeof ResizeObserverConstructor === 'function'
      ? new ResizeObserverConstructor(() => {
          scheduleCheck()
        })
      : null
    const mutationObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          if (observer !== null) {
            const root = rootRef.current
            if (root !== null) {
              observer.observe(root)
              const workspaceSection = root.querySelector<HTMLElement>('[data-dsh-just-chat-section="workspaces"]')
              if (workspaceSection !== null) observer.observe(workspaceSection)
              const tree = workspaceSection?.querySelector('[role="tree"]')
              if (tree !== null && tree !== undefined) observer.observe(tree)
            }
          }
          scheduleCheck()
        })
      : null
    const root = rootRef.current
    if (root !== null) {
      mutationObserver?.observe(root, { childList: true, subtree: true })
      if (observer !== null) {
        observer.observe(root)
        const workspaceSection = root.querySelector<HTMLElement>('[data-dsh-just-chat-section="workspaces"]')
        if (workspaceSection !== null) observer.observe(workspaceSection)
        const tree = workspaceSection?.querySelector('[role="tree"]')
        if (tree !== null && tree !== undefined) observer.observe(tree)
      }
    }

    return () => {
      disposed = true
      cancelFrame(firstFrame)
      cancelFrame(secondFrame)
      cancelFrame(scheduledFrame)
      observer?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [onInvalid, rootRef, wide])

  return <>{children}</>
}

interface SidebarErrorBoundaryProps {
  fallback: ReactNode
  onError: () => void
  children?: ReactNode
}

interface SidebarErrorBoundaryState {
  hasError: boolean
}

/** Keep a failed plugin render from blanking the host sidebar slot. */
export class SidebarErrorBoundary extends Component<SidebarErrorBoundaryProps, SidebarErrorBoundaryState> {
  state: SidebarErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): SidebarErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('dsh-just-chat sidebar disabled after render failure', error, info.componentStack)
    this.props.onError()
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
