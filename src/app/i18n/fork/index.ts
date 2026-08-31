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

import { fontsMessageDefaults, imageGenMessageDefaults, piMessageDefaults } from './locales/en'

export const forkI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code): Promise<ComponentsJSON> {
    if (code === 'zh-CN') {
      const mod = await import('./locales/zh-cn')
      return {
        rebuild: mod.default.rebuild,
        pi: mod.default.pi,
        fonts: mod.default.fonts,
        imagegen: mod.default.imagegen
      }
    }
    return {}
  }
})

export const forkPiMessages = forkI18n('pi', piMessageDefaults)

/** T41：字体白名单面板文案域（SettingsDialog fonts 分区） */
export const forkFontsMessages = forkI18n('fonts', fontsMessageDefaults)

/** T54：generate_image 凭证面板文案域（SettingsDialog media 分区） */
export const forkImageGenMessages = forkI18n('imagegen', imageGenMessageDefaults)

export function useForkFonts() {
  return useStore(forkFontsMessages)
}

/** T54：同 useForkPi 形态——返回诚实 Ref，script 内访问写 .value */
export function useForkImageGen() {
  return useStore(forkImageGenMessages)
}

// T38 修：返回诚实 Ref（照抄上游 useNotificationMessages 形态，类型推断保留
// pi 段全键含 params 函数）——script 内访问必须写 .value（同上游
// notifications.value.xxx 惯例，见 ChatPanel.vue）；T35 的 `as any` 把 Ref 谎报成
// 已解包值对象，script 侧 computed/函数中转访问静默 undefined（模板插值因 Vue
// 顶层 ref 自动解包反而正常）——回归实证见 docs/rebuild/tasks/T38-plan.md §1
export function useForkPi() {
  return useStore(forkPiMessages)
}
