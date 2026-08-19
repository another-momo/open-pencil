import { forkI18n } from './index'

/**
 * Fork-owned message groups. Add one export per owned UI domain.
 * Translations live in ./locales/<locale>.ts keyed by group name.
 */
export const rebuildMessages = forkI18n('rebuild', {
  seamProbe: 'Fork i18n seam works'
})
