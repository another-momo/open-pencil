import { useLocalStorage } from '@vueuse/core'

export type DiagnosticsRetention = 100 | 500 | 1000

const diagnosticsEnabled = useLocalStorage('open-pencil:diagnostics-enabled', true)
const usageEnabled = useLocalStorage('open-pencil:usage-enabled', true)
const diagnosticsRetention = useLocalStorage<DiagnosticsRetention>(
  'open-pencil:diagnostics-retention',
  500,
  { serializer: { read: (value) => normalizeRetention(value), write: String } }
)

function normalizeRetention(value: string): DiagnosticsRetention {
  const parsed = Number(value)
  return parsed === 100 || parsed === 1000 ? parsed : 500
}

export function isDiagnosticsEnabled(): boolean {
  return diagnosticsEnabled.value
}

export function isUsageEnabled(): boolean {
  return usageEnabled.value
}

export function getDiagnosticsRetention(): DiagnosticsRetention {
  return diagnosticsRetention.value
}
