/**
 * Fork-owned i18n seam (rebuild/v2).
 *
 * Mirrors upstream's own app-level seam (src/app/i18n/notifications/):
 * a separate createI18n instance on the shared locale atom with its own
 * lazy locale packs. packages/vue stays pristine; only zh-CN + en are
 * maintained. Fork UI components consume via useStore (as upstream's
 * useNotificationMessages does).
 */
import { createI18n } from '@nanostores/i18n'

import { locale } from '@open-pencil/vue'
import type { Locale } from '@open-pencil/vue'

export const forkI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code) {
    if (code === 'zh-CN') return (await import('./locales/zh-cn')).default
    return {}
  }
})
