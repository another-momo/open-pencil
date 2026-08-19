import { createI18n } from '@nanostores/i18n'
import type { ComponentsJSON } from '@nanostores/i18n'

import { locale } from '#vue/i18n/locale'
import type { Locale, TranslatedLocale } from '#vue/i18n/locale'

const localeLoaders = {
  'zh-CN': () => import('#vue/i18n/locales/zh-cn')
} satisfies Record<TranslatedLocale, () => Promise<{ default: ComponentsJSON }>>

export const i18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code) {
    if (code === 'en') return {}
    const mod = await localeLoaders[code]()
    return mod.default
  }
})
