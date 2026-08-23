import type React from 'react'
import { useState } from 'react'
import type { PropsHooks, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { JustChatApi } from '../api.ts'

/** Settings values owned by the host-side dsh-just-chat namespace. */
export type ConversationDirectorySettings = {
  rootDirectory?: string
  template?: string
}

export type ConversationDirectoryInjected = {
  hooks: {
    settings: SettingsScope<ConversationDirectorySettings>
  }
  api: JustChatApi
  saveSettings(rootDirectory: string, template: string): Promise<void>
}

/** Settings page for the root directory and generated directory name template. */
export function ConversationDirectorySection(props: PropsRuntime<'settings.section'> & Omit<ConversationDirectoryInjected, 'hooks'> & PropsHooks<ConversationDirectoryInjected['hooks']>): React.ReactElement {
  const snapshot = props.useSettings(state => state)
  const [rootDirectory, setRootDirectory] = useState(snapshot.value?.rootDirectory ?? '')
  const [template, setTemplate] = useState(snapshot.value?.template ?? '${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}')
  const [preview, setPreview] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const save = async (): Promise<void> => {
    setError(undefined)
    try {
      await props.saveSettings(rootDirectory.trim(), template)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const showPreview = async (): Promise<void> => {
    setError(undefined)
    try {
      const result = await props.api.preview(template, '示例消息 example')
      if (!result.valid) setError(result.message ?? '模板无效')
      setPreview(result.path)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <section aria-labelledby="dsh-just-chat-settings-title">
      <h2 id="dsh-just-chat-settings-title">对话目录</h2>
      <label>
        对话根目录
        <input value={rootDirectory} onChange={event => { setRootDirectory(event.currentTarget.value) }} />
      </label>
      <label>
        目录名模板
        <input value={template} onChange={event => { setTemplate(event.currentTarget.value) }} />
      </label>
      <button type="button" onClick={() => { void showPreview() }}>预览</button>
      <button type="button" onClick={() => { void save() }}>保存</button>
      {preview !== undefined && <output>{preview}</output>}
      {error !== undefined && <p role="alert">{error}</p>}
      <button type="button" onClick={props.close}>关闭</button>
    </section>
  )
}
