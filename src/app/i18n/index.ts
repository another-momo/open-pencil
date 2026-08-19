/**
 * Fork-owned i18n seam (rebuild/v2).
 *
 * Upstream packages/vue stays pristine: we create our own createI18n
 * instance bound to the SAME locale atom (read-only dependency on
 * #vue/i18n/locale), with fork-owned component groups and lazy locale
 * packs. Fork UI components consume via useI18nNamespace (exported from
 * #vue/i18n/useI18n) or useStore directly. Only zh-CN + en are maintained.
 */
import { createI18n } from '@nanostores/i18n'

import { locale } from '#vue/i18n/locale'
import type { Locale } from '#vue/i18n/locale'

export const forkI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code) {
    if (code === 'zh-CN') return (await import('./locales/zh-cn')).default
    return {}
  }
})
