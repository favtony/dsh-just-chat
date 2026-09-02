import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  isExpandedSidebarLayoutUsable,
  SIDEBAR_SECTION_STYLE,
  SidebarErrorBoundary,
  SidebarLayoutGuard,
} from '../../src/client/sidebar-layout-guard.tsx'

let dom: JSDOM | undefined
let mountedRoot: Root | undefined

function setRect(element: Element, width: number, height: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

function createFixture(): HTMLDivElement {
  const root = document.createElement('div')
  root.dataset.dshJustChatSidebar = 'true'
  const section = document.createElement('div')
  section.dataset.dshJustChatSection = 'workspaces'
  const browser = document.createElement('div')
  const tree = document.createElement('div')
  tree.setAttribute('role', 'tree')
  browser.append(tree)
  section.append(browser)
  root.append(section)
  document.body.append(root)
  setRect(root, 240, 600)
  setRect(section, 240, 120)
  setRect(browser, 240, 120)
  setRect(tree, 240, 80)
  return root
}

function installDom(): void {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.window.document)
  vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  dom.window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    callback(0)
    return 1
  }
  dom.window.cancelAnimationFrame = (_handle: number): void => {}
}

afterEach(async () => {
  await act(async () => {
    mountedRoot?.unmount()
  })
  mountedRoot = undefined
  dom?.window.close()
  dom = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sidebar layout protection', () => {
  it('keeps both sections as natural-height children of one scroller', () => {
    expect(SIDEBAR_SECTION_STYLE).toMatchObject({ display: 'block', flex: 'none' })
  })

  it('accepts an expanded workspace tree with usable geometry', () => {
    installDom()
    const root = createFixture()
    expect(isExpandedSidebarLayoutUsable(root)).toBe(true)
  })

  it('rejects a collapsed workspace tree', () => {
    installDom()
    const root = createFixture()
    const tree = root.querySelector('[role="tree"]')
    if (tree === null) throw new Error('fixture tree missing')
    setRect(tree, 240, 0)
    expect(isExpandedSidebarLayoutUsable(root)).toBe(false)
  })

  it('injects scoped styles and reports repeated expanded-layout failure', async () => {
    installDom()
    const fixture = createFixture()
    const tree = fixture.querySelector('[role="tree"]')
    if (tree === null) throw new Error('fixture tree missing')
    setRect(tree, 240, 0)
    const rootRef = { current: fixture }
    const onInvalid = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    mountedRoot = createRoot(container)

    await act(async () => {
      mountedRoot?.render(
        <SidebarLayoutGuard wide rootRef={rootRef} onInvalid={onInvalid} />,
      )
    })

    expect(document.head.textContent).toContain('overflow-y: visible')
    expect(onInvalid).toHaveBeenCalledTimes(1)
  })

  it('renders the official fallback after a plugin render error', async () => {
    installDom()
    const onError = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    mountedRoot = createRoot(container)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    function BrokenChild(): never {
      throw new Error('broken sidebar')
    }

    await act(async () => {
      mountedRoot?.render(
        <SidebarErrorBoundary fallback={<span>official</span>} onError={onError}>
          <BrokenChild />
        </SidebarErrorBoundary>,
      )
    })

    expect(container.textContent).toBe('official')
    expect(onError).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
    warningSpy.mockRestore()
  })

  it('does not check geometry while the sidebar is collapsed', async () => {
    installDom()
    const rootRef = { current: null }
    const onInvalid = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    mountedRoot = createRoot(container)

    await act(async () => {
      mountedRoot?.render(
        <SidebarLayoutGuard wide={false} rootRef={rootRef} onInvalid={onInvalid} />,
      )
    })

    expect(onInvalid).not.toHaveBeenCalled()
  })
})
