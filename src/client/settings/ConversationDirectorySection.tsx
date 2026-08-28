import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  Button,
  IconBrowseOutline16,
  IconChevronDownOutline14,
  Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsHooks, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_TEMPLATE } from '../../shared/template.ts'
import type { JustChatApi } from '../api.ts'
import cssText from './ConversationDirectorySection.module.css?inline'

const CSS_TAG_ID = 'dsh-just-chat/ConversationDirectorySection.module.css'
const styles = {
  card: 'dshJustChatSettingsCard',
  cardOpen: 'dshJustChatSettingsCardOpen',
  header: 'dshJustChatSettingsHeader',
  headText: 'dshJustChatSettingsHeadText',
  title: 'dshJustChatSettingsTitle',
  description: 'dshJustChatSettingsDescription',
  pending: 'dshJustChatSettingsPending',
  chevron: 'dshJustChatSettingsChevron',
  chevronOpen: 'dshJustChatSettingsChevronOpen',
  body: 'dshJustChatSettingsBody',
  readOnly: 'dshJustChatSettingsReadOnly',
  field: 'dshJustChatSettingsField',
  fieldHead: 'dshJustChatSettingsFieldHead',
  label: 'dshJustChatSettingsLabel',
  fieldDescription: 'dshJustChatSettingsFieldDescription',
  control: 'dshJustChatSettingsControl',
  pathInput: 'dshJustChatSettingsPathInput',
  templateInput: 'dshJustChatSettingsTemplateInput',
  templateHelp: 'dshJustChatSettingsTemplateHelp',
  templateDefault: 'dshJustChatSettingsTemplateDefault',
  variables: 'dshJustChatSettingsVariables',
  variable: 'dshJustChatSettingsVariable',
  variableName: 'dshJustChatSettingsVariableName',
  variableDescription: 'dshJustChatSettingsVariableDescription',
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

const TEMPLATE_VARIABLES = [
  { expression: '${date.yyyy}', description: '主机本地时区的四位年份。' },
  { expression: '${date.MM}', description: '两位月份。' },
  { expression: '${date.dd}', description: '两位日期。' },
  { expression: '${time.HH}', description: '两位小时，使用 24 小时制。' },
  { expression: '${time.mm}', description: '两位分钟。' },
  { expression: '${time.ss}', description: '两位秒。' },
  { expression: '${message.firstSentence}', description: '消息按中英文逗号和句号分割后的第一个非空片段。' },
  { expression: '${message.words(n)}', description: '前 n 个英文单词；n 必须是 1 到 32 的十进制整数。' },
] as const

type ConversationDirectoryCardProps = PropsRuntime<'settings.plugin.item'>
  & Omit<ConversationDirectoryInjected, 'hooks'>
  & PropsHooks<ConversationDirectoryInjected['hooks']>

type SavedSettings = {
  rootDirectory: string
  template: string
}

function settingsValue(snapshot: { value: ConversationDirectorySettings | undefined }): SavedSettings {
  return {
    rootDirectory: snapshot.value?.rootDirectory ?? '',
    template: snapshot.value?.template ?? DEFAULT_TEMPLATE,
  }
}

/** Official plugin-configuration card for the automatic conversation directory. */
export function ConversationDirectorySection(props: ConversationDirectoryCardProps): React.ReactElement | null {
  const snapshot = props.useSettings(state => state)
  const unavailable = snapshot.status === 'unavailable'

  const initial = settingsValue(snapshot)
  const [rootDirectory, setRootDirectory] = useState(initial.rootDirectory)
  const [template, setTemplate] = useState(initial.template)
  const [saved, setSaved] = useState<SavedSettings>(initial)
  const [preview, setPreview] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [pickingDirectory, setPickingDirectory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const savedRequest = useRef<SavedSettings | null>(null)

  const snapshotValue = settingsValue(snapshot)
  const dirty = rootDirectory.trim() !== saved.rootDirectory || template !== saved.template

  useEffect(() => {
    if (dirty || saving) return
    const request = savedRequest.current
    if (request !== null) {
      if (snapshotValue.rootDirectory !== request.rootDirectory || snapshotValue.template !== request.template) return
      savedRequest.current = null
    }
    if (snapshotValue.rootDirectory === saved.rootDirectory && snapshotValue.template === saved.template) return
    setRootDirectory(snapshotValue.rootDirectory)
    setTemplate(snapshotValue.template)
    setSaved(snapshotValue)
  }, [dirty, saving, saved.rootDirectory, saved.template, snapshotValue.rootDirectory, snapshotValue.template])

  const ready = snapshot.status === 'ready'
  const controlsDisabled = !ready || !snapshot.writable || saving

  if (unavailable) return null

  const editRootDirectory = (value: string): void => {
    setRootDirectory(value)
    setError(undefined)
    setPreview(undefined)
  }

  const editTemplate = (value: string): void => {
    setTemplate(value)
    setError(undefined)
    setPreview(undefined)
  }

  const browse = async (): Promise<void> => {
    setError(undefined)
    setPickingDirectory(true)
    try {
      const selected = await props.pickDirectory()
      if (selected !== null) editRootDirectory(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPickingDirectory(false)
    }
  }

  const save = async (): Promise<void> => {
    if (controlsDisabled || !dirty) return
    setError(undefined)
    setSaving(true)
    const next = { rootDirectory: rootDirectory.trim(), template }
    try {
      await props.saveSettings(next.rootDirectory, next.template)
      setRootDirectory(next.rootDirectory)
      setSaved(next)
      savedRequest.current = next
      setPreview(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  const discard = (): void => {
    if (saving) return
    setRootDirectory(saved.rootDirectory)
    setTemplate(saved.template)
    setPreview(undefined)
    setError(undefined)
  }

  const showPreview = async (): Promise<void> => {
    setError(undefined)
    try {
      const result = await props.api.preview(template, '示例消息 example')
      if (!result.valid) {
        setPreview(undefined)
        setError(result.message ?? '模板无效')
        return
      }
      setPreview(result.path)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const bodyId = 'dsh-just-chat-settings-body'

  return (
    <article className={`${styles.card} ${open ? styles.cardOpen : ''}`}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className={styles.headText}>
          <span className={styles.title}>对话目录</span>
          <span className={styles.description}>设置自动对话的根目录和目录名模板。</span>
        </span>
        {dirty && <span className={styles.pending}>未保存</span>}
        <IconChevronDownOutline14 className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      {open && (
        <div className={styles.body} id={bodyId}>
          {!snapshot.writable && <p className={styles.readOnly} role="status">此部署的设置为只读。</p>}
          <div className={styles.field}>
            <div className={styles.fieldHead}>
              <label className={styles.label} htmlFor="dsh-just-chat-root-directory">对话根目录</label>
            </div>
            <p className={styles.fieldDescription}>选择保存自动对话的现有目录。</p>
            <div className={styles.control}>
              <Input
                id="dsh-just-chat-root-directory"
                className={styles.pathInput}
                value={rootDirectory}
                disabled={controlsDisabled || pickingDirectory}
                onChange={event => { editRootDirectory(event.currentTarget.value) }}
              />
              <Button
                variant="outline"
                size="sm"
                icon={<IconBrowseOutline16 size={16} />}
                disabled={controlsDisabled || pickingDirectory}
                onClick={() => { void browse() }}
              >
                浏览
              </Button>
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldHead}>
              <label className={styles.label} htmlFor="dsh-just-chat-template">目录名模板</label>
            </div>
            <p className={styles.fieldDescription}>每条消息按模板生成相对目录路径，只支持下方列出的参数。</p>
            <Input
              id="dsh-just-chat-template"
              className={styles.templateInput}
              value={template}
              disabled={controlsDisabled}
              onChange={event => { editTemplate(event.currentTarget.value) }}
            />
            <div className={styles.templateHelp}>
              <p className={styles.templateDefault}>默认模板：<code>{DEFAULT_TEMPLATE}</code></p>
              <dl className={styles.variables}>
                {TEMPLATE_VARIABLES.map(variable => (
                  <div className={styles.variable} key={variable.expression}>
                    <dt className={styles.variableName}><code>{variable.expression}</code></dt>
                    <dd className={styles.variableDescription}>{variable.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className={styles.actions}>
            {error !== undefined && <p className={styles.error} role="alert">{error}</p>}
            <Button variant="outline" disabled={saving} onClick={() => { void showPreview() }}>预览</Button>
            <Button variant="outline" disabled={!dirty || saving} onClick={discard}>放弃修改</Button>
            <Button variant="primary" disabled={!dirty || controlsDisabled} onClick={() => { void save() }}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
          {preview !== undefined && <output className={styles.preview} aria-live="polite">示例预览：{preview}</output>}
        </div>
      )}
    </article>
  )
}
