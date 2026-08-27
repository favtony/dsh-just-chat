import type React from 'react'
import { useState } from 'react'
import {
  Button,
  IconBrowseOutline16,
  Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsHooks, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { JustChatApi } from '../api.ts'
import cssText from './ConversationDirectorySection.module.css?inline'

const CSS_TAG_ID = 'dsh-just-chat/ConversationDirectorySection.module.css'
const styles = {
  root: 'dshJustChatSettingsRoot',
  heading: 'dshJustChatSettingsHeading',
  row: 'dshJustChatSettingsRow',
  rowText: 'dshJustChatSettingsRowText',
  title: 'dshJustChatSettingsTitle',
  description: 'dshJustChatSettingsDescription',
  pathControl: 'dshJustChatSettingsPathControl',
  pathInput: 'dshJustChatSettingsPathInput',
  templateInput: 'dshJustChatSettingsTemplateInput',
  actions: 'dshJustChatSettingsActions',
  preview: 'dshJustChatSettingsPreview',
  error: 'dshJustChatSettingsError',
}

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-just-chat'
  tag.dataset.pluginCss = CSS_TAG_ID
  tag.textContent = cssText
  document.head.appendChild(tag)
}

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
  pickDirectory(): Promise<string | null>
  saveSettings(rootDirectory: string, template: string): Promise<void>
}

/** Settings page for the root directory and generated directory name template. */
export function ConversationDirectorySection(props: PropsRuntime<'settings.section'> & Omit<ConversationDirectoryInjected, 'hooks'> & PropsHooks<ConversationDirectoryInjected['hooks']>): React.ReactElement {
  const snapshot = props.useSettings(state => state)
  const [rootDirectory, setRootDirectory] = useState(snapshot.value?.rootDirectory ?? '')
  const [template, setTemplate] = useState(snapshot.value?.template ?? '${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}')
  const [preview, setPreview] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [pickingDirectory, setPickingDirectory] = useState(false)

  const browse = async (): Promise<void> => {
    setError(undefined)
    setPickingDirectory(true)
    try {
      const selected = await props.pickDirectory()
      if (selected !== null) setRootDirectory(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPickingDirectory(false)
    }
  }

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
    <section className={styles.root} aria-labelledby="dsh-just-chat-settings-title">
      <h2 className={styles.heading} id="dsh-just-chat-settings-title">对话目录</h2>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <div className={styles.title} id="dsh-just-chat-root-directory-label">对话根目录</div>
          <div className={styles.description}>选择保存自动对话的现有目录。</div>
        </div>
        <div className={styles.pathControl}>
          <Input
            className={styles.pathInput}
            value={rootDirectory}
            aria-labelledby="dsh-just-chat-root-directory-label"
            onChange={event => { setRootDirectory(event.currentTarget.value) }}
          />
          <Button
            variant="outline"
            size="sm"
            icon={<IconBrowseOutline16 size={16} />}
            disabled={pickingDirectory}
            onClick={() => { void browse() }}
          >
            浏览
          </Button>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <div className={styles.title} id="dsh-just-chat-template-label">目录名模板</div>
          <div className={styles.description}>每条消息按模板生成相对目录路径。</div>
        </div>
        <Input
          className={styles.templateInput}
          value={template}
          aria-labelledby="dsh-just-chat-template-label"
          onChange={event => { setTemplate(event.currentTarget.value) }}
        />
      </div>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => { void showPreview() }}>预览</Button>
        <Button variant="primary" onClick={() => { void save() }}>保存</Button>
      </div>
      {preview !== undefined && <output className={styles.preview} aria-live="polite">{preview}</output>}
      {error !== undefined && <p className={styles.error} role="alert">{error}</p>}
    </section>
  )
}
