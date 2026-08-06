// Session-scoped record of MCP server unavailability. When the MCP server
// is not installed/running, the first failed probe is remembered so later
// probes (additional ProviderSelect mounts, spawn retries) skip the noisy
// health-check burst instead of timing out again for several seconds.
let unavailable = false

export function markMCPUnavailable(): void {
  unavailable = true
}

export function markMCPAvailable(): void {
  unavailable = false
}

export function isMCPUnavailable(): boolean {
  return unavailable
}
