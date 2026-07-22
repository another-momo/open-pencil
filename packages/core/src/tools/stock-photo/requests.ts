import { parseJsonArrayParam } from '#core/tools/json-array'

import type { PhotoRequest } from './apply'

export interface ParsedPhotoRequests {
  requests: PhotoRequest[]
  warning?: string
}

export function parsePhotoRequests(value: unknown): ParsedPhotoRequests | { error: string } {
  const parsed = parseJsonArrayParam(value, 'requests')
  if ('error' in parsed) return parsed

  if (parsed.items.length === 0) return { error: 'Empty requests array' }
  const result: ParsedPhotoRequests = { requests: parsed.items as PhotoRequest[] }
  if (parsed.warning) result.warning = parsed.warning
  return result
}
