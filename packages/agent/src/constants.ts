/**
 * Agent backend defaults. Override via environment variables:
 *   OPENPENCIL_AGENT_PORT  — TCP port (default 7601)
 *   OPENPENCIL_AGENT_HOST  — bind address (default 127.0.0.1)
 */

export const AGENT_DEFAULT_PORT = 7601
export const AGENT_DEFAULT_HOST = '127.0.0.1'

// Read at module load; works for both bundled dist (npm_package_version)
// and direct ts source via tsx/bun.
export const AGENT_VERSION: string =
  process.env.OPENPENCIL_AGENT_VERSION?.trim() ||
  (process.env.npm_package_version?.trim() ?? '0.0.0')

export function agentPort(): number {
  const raw = process.env.OPENPENCIL_AGENT_PORT?.trim()
  if (!raw) return AGENT_DEFAULT_PORT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid OPENPENCIL_AGENT_PORT: ${raw}`)
  }
  return parsed
}

export function agentHost(): string {
  return process.env.OPENPENCIL_AGENT_HOST?.trim() || AGENT_DEFAULT_HOST
}