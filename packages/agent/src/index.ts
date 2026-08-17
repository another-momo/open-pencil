/**
 * Public surface for consumers (tests, integrations). The CLI entry point
 * is `start.ts` and the HTTP server is built by `server.ts`.
 */
export { createAgent, MAX_AGENT_STEPS } from './agent-loop.js'
export type { AgentRunOptions, ChatMode } from './agent-loop.js'
export { createAgentServer, startServer } from './server.js'
export type { ServerHandle } from './server.js'
export { FrontendBridge } from './bridge/ws-client.js'
export type { BridgeInfo, FrontendBridgeEvents, RpcResponse, RpcEnvelope } from './bridge/ws-client.js'
export {
  buildMarketingOverlay,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_MARKETING_FULL
} from './prompts/index.js'
export type { BrandSelection } from './prompts/index.js'
export {
  consumeCredential,
  forgetCredential,
  putCredential
} from './credentials.js'
export {
  consumeCredentialAsync,
  forgetCredentialAsync,
  putCredentialAsync,
  activeConnectionCountAsync,
  createCredentialStore,
  credentialStoreKind,
  resetCredentialStore,
  setCredentialStore
} from './credentials.js'
export type { CredentialStore } from './credentials.js'
export { resolveModelsDevModel } from './catalog.js'
export {
  readAgentDiscovery,
  removeAgentDiscovery,
  writeAgentDiscovery
} from './discovery.js'
export type { AgentDiscoveryInfo } from './discovery.js'
export { agentHost, agentPort, AGENT_DEFAULT_HOST, AGENT_DEFAULT_PORT } from './constants.js'