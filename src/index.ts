import type { Context } from '@deepseek-ai/cordis'
import { createConversationRoute } from './host/routes.ts'
import { ConversationPreparationService } from './host/preparation.ts'
import { recoverConversationRecords, getLiveSessions, type SessionPersistenceLike } from './host/recovery.ts'
import { openConversationRecords } from './host/records.ts'
import { registerConversationSettings } from './host/settings.ts'

/** Cordis plugin name. */
export const name = 'dsh-just-chat'

/** Services required from the official Web profile. */
export const inject = ['webServer', 'settings', 'storageDomain', 'sessionPersistence', 'sessions']

/** Install settings, durable records, recovery, and the HTTP route on one fiber. */
export function apply(ctx: Context): void {
  ctx.inject(inject, hostCtx => {
    const settings = registerConversationSettings(hostCtx)
    hostCtx.effect(async () => {
      const { domain, records } = await openConversationRecords(hostCtx)
      const persistence = hostCtx.get('sessionPersistence') as SessionPersistenceLike
      const liveSessions = getLiveSessions(hostCtx)
      await recoverConversationRecords(records, persistence, liveSessions)
      const preparation = new ConversationPreparationService(() => settings.get(), records)
      const route = createConversationRoute({
        preparation,
        records,
        persistence,
        liveSessions,
        settings,
      })
      const unregister = hostCtx.webServer.register(route)
      return async () => {
        unregister()
        await domain.close()
      }
    }, 'dsh-just-chat.host')
  })
}
