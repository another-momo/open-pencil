import { randomUUID } from 'node:crypto'
import process from 'node:process'

import { agentPlugin } from '../src/app/automation/bridge/agent-vite-plugin'
import { automationPlugin } from '../src/app/automation/bridge/vite-plugin'

const devAutomationAuthToken = process.env.OPENPENCIL_DEV_TOKEN ?? randomUUID()

export function localAutomationToken(command: string): string | null {
  return command === 'serve' ? devAutomationAuthToken : null
}

export function automationCORSOrigin(host: string | undefined): string {
  return host ? `http://${host}:1420` : 'http://localhost:1420'
}

export function openPencilAutomationPlugin(command: string, host: string | undefined) {
  return automationPlugin(localAutomationToken(command), automationCORSOrigin(host))
}

// Symmetric to `openPencilAutomationPlugin`: spawn the agent backend in
// dev so the frontend gets Path A (HTTP agent transport) without a second
// terminal. Production builds (`vite build`) get a no-op plugin.
export function openPencilAgentPlugin(command: string, host: string | undefined) {
  return agentPlugin(automationCORSOrigin(host), command === 'serve')
}
