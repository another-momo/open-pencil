/**
 * Fork-owned i18n seam (rebuild/v2).
 *
 * Mirrors upstream's own app-level seam (src/app/i18n/notifications/):
 * a separate createI18n instance on the shared locale atom with its own
 * lazy locale packs. packages/vue stays pristine; only zh-CN + en are
 * maintained. Fork UI components consume via useStore (as upstream's
 * useNotificationMessages does).
 *
 * T35：撤销 P38/P40（packages/vue 上 pi 段），fork seam 接管 pi 段 i18n 全集：
 * - en 默认值在 locales/en.ts（仿 notificationMessageDefaults）
 * - zh-CN locale pack 在 locales/zh-cn.ts
 * - useForkPi() 暴露 reactive translations 给 settings 面板
 */
import { createI18n, type ComponentsJSON } from '@nanostores/i18n'
import { useStore } from '@nanostores/vue'

import { locale, type Locale } from '@open-pencil/vue'

import { piMessageDefaults } from './locales/en'
import zhCN, { type PiNamespace } from './locales/zh-cn'

export const forkI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code): Promise<ComponentsJSON> {
    if (code === 'zh-CN') return { pi: zhCN.pi }
    return {}
  }
})

export const forkPiMessages = forkI18n('pi', piMessageDefaults)

export function useForkPi(): PiNamespace {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- nanostores/i18n store 形状对齐 zh-CN locale 结构
  return useStore(forkPiMessages) as any as PiNamespace
}
