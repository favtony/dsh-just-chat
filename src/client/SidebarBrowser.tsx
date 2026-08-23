import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsHooks, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SidebarInjected } from './types.ts'

function relativeUpdatedAt(updatedAt: number): string {
  const elapsed = Math.max(0, Date.now() - updatedAt)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (elapsed < minute) return '刚刚'
  if (elapsed < hour) return `${Math.floor(elapsed / minute)} 分钟前`
  if (elapsed < day) return `${Math.floor(elapsed / hour)} 小时前`
  return `${Math.floor(elapsed / day)} 天前`
}

/**
 * Complete sidebar-workspaces replacement. It uses public snapshots and keeps
 * the plugin's active-record projection separate from ordinary workspaces.
 */
export function SidebarBrowser(props: PropsRuntime<'sidebar.workspaces'> & PropsRenderSlots<'sidebar.workspaces.directoryFlow'> & Omit<SidebarInjected, 'hooks'> & PropsHooks<SidebarInjected['hooks']>): React.ReactElement {
  const sessions = props.useSessions(state => state)
  const workspaceState = props.useWorkspaces(state => state)
  const view = props.useView(state => state)
  const manualOrder = props.useOrder(state => state.sessionIds)
  const directoryFlowAvailable = props.useDirectoryFlow(occupied => occupied)
  const workspaces = workspaceState.items
  const records = useMemo(() => [...view.prepared, ...view.active], [view.active, view.prepared])
  const [query, setQuery] = useState('')
  const [searchIds, setSearchIds] = useState<readonly SessionId[] | undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [dragged, setDragged] = useState<SessionId | undefined>(undefined)
  const [editing, setEditing] = useState<{ sessionId: SessionId; title: string } | undefined>(undefined)
  const [rowError, setRowError] = useState<string | undefined>(undefined)
  const [directoryFlowOpen, setDirectoryFlowOpen] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const abortRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    if (!directoryFlowAvailable) setDirectoryFlowOpen(false)
  }, [directoryFlowAvailable])

  useEffect(() => {
    void props.refreshConversationRecords()
    return () => { abortRef.current?.abort() }
  }, [props.refreshConversationRecords])

  const activeIds = useMemo(() => new Set(records.filter(record => record.status === 'active').map(record => record.sessionId)), [records])
  const archived = useMemo(() => new Set(workspaceState.archivedSessionIds), [workspaceState.archivedSessionIds])
  const automatic = useMemo(() => {
    const rows = records
      .filter(record => record.status === 'active')
      .map(record => sessions.byId[record.sessionId])
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .filter(row => row.parentId === undefined && row.origin !== 'subagent' && !archived.has(row.id))
    const initial = rows.slice().sort((a, b) => {
      const aRecord = records.find(record => record.sessionId === a.id)
      const bRecord = records.find(record => record.sessionId === b.id)
      const time = (bRecord?.createdAt ?? 0) - (aRecord?.createdAt ?? 0)
      return time !== 0 ? time : a.id.localeCompare(b.id)
    })
    if (manualOrder.length === 0) return initial
    const rank = new Map(manualOrder.map((id, index) => [id, index]))
    return initial.slice().sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  }, [archived, manualOrder, records, sessions.byId])

  useEffect(() => {
    abortRef.current?.abort()
    const normalized = query.trim()
    if (normalized === '') {
      setSearchIds(undefined)
      setSearching(false)
      return
    }
    const titleHits = automatic.filter(row => row.displayTitle.toLocaleLowerCase().includes(normalized.toLocaleLowerCase())).map(row => row.id)
    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)
    setRowError(undefined)
    void props.searchMessages(normalized, controller.signal).then(results => {
      if (controller.signal.aborted) return
      setSearchIds([...new Set([...titleHits, ...results.filter(result => activeIds.has(result.sessionId)).map(result => result.sessionId)])])
      setSearching(false)
    }).catch(error => {
      if (controller.signal.aborted) return
      setSearchIds([])
      setSearching(false)
      setRowError(error instanceof Error ? error.message : String(error))
    })
    return () => { controller.abort() }
  }, [activeIds, automatic, query, props.searchMessages])

  const visibleAutomatic = searchIds === undefined ? automatic : automatic.filter(row => searchIds.includes(row.id))
  const drop = (beforeSessionId?: SessionId): void => {
    if (dragged === undefined) return
    props.setManualOrder(dragged, beforeSessionId)
    setDragged(undefined)
  }
  const rename = async (): Promise<void> => {
    if (editing === undefined || editing.title.trim() === '') return
    setRowError(undefined)
    try {
      await props.renameSession(editing.sessionId, editing.title.trim())
      setEditing(undefined)
    } catch (error) {
      setRowError(error instanceof Error ? error.message : String(error))
    }
  }
  const directoryFlow: DirectoryFlowOwnerProps = {
    open: directoryFlowOpen,
    busy: creatingWorkspace,
    onPicked: path => {
      setCreatingWorkspace(true)
      setRowError(undefined)
      void props.createWorkspace(path).then(workspaceId => {
        setDirectoryFlowOpen(false)
        props.startWorkspaceSession(workspaceId)
      }).catch(error => {
        setDirectoryFlowOpen(false)
        setRowError(error instanceof Error ? error.message : String(error))
      }).finally(() => { setCreatingWorkspace(false) })
    },
    onCancel: () => { setDirectoryFlowOpen(false) },
    onError: message => {
      setDirectoryFlowOpen(false)
      setRowError(message)
    },
  }

  return (
    <div aria-label="工作区和对话" data-wide={props.wide}>
      {!props.wide && <button type="button" onClick={props.expandSidebar} aria-label="展开侧栏">展开</button>}
      <section aria-label="工作区">
        <header>
          <span>工作区</span>
          <button type="button" onClick={() => { props.startWorkspaceSession() }}>新建对话</button>
          {directoryFlowAvailable && (
            <button type="button" disabled={creatingWorkspace} onClick={() => { setRowError(undefined); setDirectoryFlowOpen(true) }}>添加工作区</button>
          )}
        </header>
        {workspaces.map(workspace => (
          <div key={workspace.workspaceId}>
            <button type="button" onClick={() => { props.startWorkspaceSession(workspace.workspaceId) }}>{workspace.title ?? workspace.path}</button>
            <span>{workspace.sessionIds.length}</span>
          </div>
        ))}
      </section>
      {props.renderSlot('sidebar.workspaces.directoryFlow', directoryFlow)}
      <section aria-label="对话">
        <header><span>对话</span><input value={query} placeholder="搜索对话" onChange={event => { setQuery(event.currentTarget.value) }} /></header>
        {visibleAutomatic.map(row => {
          const status = row.pendingInteraction !== undefined
            ? '等待处理'
            : row.running
              ? '运行中'
              : row.completed === true
                ? '已完成'
                : undefined
          const editingRow = editing?.sessionId === row.id ? editing : undefined
          return (
          <div
            key={row.id}
            draggable
            data-selected={sessions.current === row.id}
            onDragStart={() => { setDragged(row.id) }}
            onDragOver={event => { event.preventDefault() }}
            onDrop={() => { drop(row.id) }}
          >
            <button type="button" aria-current={sessions.current === row.id ? 'page' : undefined} onClick={() => { props.openSession(row.id) }}>
              <span>{row.displayTitle}</span>
              {status !== undefined && <span aria-label={status}>{status}</span>}
              <time dateTime={new Date(row.updatedAt).toISOString()}>{relativeUpdatedAt(row.updatedAt)}</time>
            </button>
            <details>
              <summary aria-label={`${row.displayTitle} 的菜单`}>更多</summary>
              <button type="button" onClick={() => { setEditing({ sessionId: row.id, title: row.displayTitle }); setRowError(undefined) }}>重命名</button>
              <button type="button" onClick={() => {
                setRowError(undefined)
                void props.forkSession(row.id).catch(error => {
                  setRowError(error instanceof Error ? error.message : String(error))
                })
              }}>分叉</button>
              <button type="button" onClick={() => {
                setRowError(undefined)
                void props.archiveSession(row.id).catch(error => {
                  setRowError(error instanceof Error ? error.message : String(error))
                })
              }}>归档</button>
            </details>
            {editingRow !== undefined && (
              <form onSubmit={event => { event.preventDefault(); void rename() }}>
                <input
                  aria-label="对话标题"
                  value={editingRow.title}
                  onChange={event => {
                    const title = event.currentTarget.value
                    setEditing(current => {
                      if (current === undefined || current.sessionId !== row.id) return current
                      return { sessionId: current.sessionId, title }
                    })
                  }}
                />
                <button type="submit">保存标题</button>
                <button type="button" onClick={() => { setEditing(undefined) }}>取消</button>
              </form>
            )}
          </div>
        )})}
        {searching && <p role="status">正在搜索</p>}
        {rowError !== undefined && <p role="alert">{rowError}</p>}
        {visibleAutomatic.length === 0 && <p>暂无对话</p>}
      </section>
    </div>
  )
}
