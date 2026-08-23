import type React from 'react'
import { useEffect, useState } from 'react'
import type { DirectoryFlowOwnerProps, WorkspacePickerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspacePickerInjected } from './types.ts'

/** Extends the official workspace picker with the pre-session just-chat choice. */
export function WorkspacePicker(props: Omit<WorkspacePickerProps, 't'> & WorkspacePickerInjected): React.ReactElement {
  const workspaces = props.useWorkspaces(state => state.items)
  const flowAvailable = props.useDirectoryFlow(occupied => occupied)
  const [flowOpen, setFlowOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!flowAvailable) setFlowOpen(false)
  }, [flowAvailable])

  const closeMenu = (): void => { props.onClose() }
  const chooseWorkspace = (workspaceId: WorkspaceId): void => {
    props.chooseWorkspace()
    props.onPick(workspaceId)
    closeMenu()
  }
  const chooseJustChat = (): void => {
    props.chooseJustChat()
    closeMenu()
  }
  const directoryFlow: DirectoryFlowOwnerProps = {
    open: flowOpen,
    busy: picking,
    onPicked: path => {
      setPicking(true)
      void props.createWorkspace({ path }).then(workspace => {
        setFlowOpen(false)
        props.onPick(workspace.workspaceId)
      }).catch(reason => {
        setFlowOpen(false)
        setError(reason instanceof Error ? reason.message : String(reason))
      }).finally(() => { setPicking(false) })
    },
    onCancel: () => { setFlowOpen(false) },
    onError: message => {
      setFlowOpen(false)
      setError(message)
    },
  }

  return (
    <div aria-label="工作区选择" data-open={props.open}>
      {props.open && (
        <div role="menu">
          {workspaces.map(workspace => (
            <button
              key={workspace.workspaceId}
              type="button"
              role="menuitem"
              disabled={picking}
              onClick={() => { chooseWorkspace(workspace.workspaceId) }}
            >
              {workspace.title ?? workspace.path}
            </button>
          ))}
          {flowAvailable && <button type="button" role="menuitem" disabled={picking} onClick={() => { setError(undefined); setFlowOpen(true); closeMenu() }}>添加工作区</button>}
          <button type="button" role="menuitem" disabled={picking} onClick={chooseJustChat}>不在项目中工作</button>
        </div>
      )}
      {props.renderSlot('conversation.hero.workspace.directoryFlow', directoryFlow)}
      {error !== undefined && <p role="alert">{error}</p>}
    </div>
  )
}
