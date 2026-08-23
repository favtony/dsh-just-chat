import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import { DEFAULT_TEMPLATE, parseTemplate, previewTemplate } from '../shared/template.ts'
import { validateRootPath } from '../shared/path.ts'
import type { ConversationDirectorySettings } from '../shared/types.ts'

/** Settings namespace used by the existing DSH settings panel. */
export const CONVERSATION_SETTINGS_NAMESPACE = settingsNamespace('dsh-just-chat')

/** Composition defaults; an empty root intentionally does not create anything. */
export const DEFAULT_SETTINGS: ConversationDirectorySettings = {
  rootDirectory: '',
  template: DEFAULT_TEMPLATE,
}

const ConversationSettingsSchema: z<ConversationDirectorySettings> = z.object({
  rootDirectory: z.string().default(''),
  template: z.string().default(DEFAULT_TEMPLATE),
})

/** Register the plugin settings on the owning Cordis fiber. */
export function registerConversationSettings(ctx: Context): SettingsScope<ConversationDirectorySettings> {
  return ctx.settings.register(CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema, {
    base: DEFAULT_SETTINGS,
    validate: value => {
      if (value.rootDirectory.length > 0) validateRootPath(value.rootDirectory)
      parseTemplate(value.template)
      previewTemplate(value.template, 'Example message.', new Date(2000, 0, 2, 3, 4, 5))
    },
  })
}
