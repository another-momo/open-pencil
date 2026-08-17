import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

/**
 * Vite plugin that spawns the local agent backend (`@open-pencil/agent`)
 * as a child process during `bun run dev`, so the frontend gets Path A
 * (agent backend) routing without a second terminal.
 *
 * Symmetric to `automationPlugin` (which spawns the MCP server):
 *   - `configureServer` starts the child once Vite is up
 *   - `buildEnd` (or vite close) kills the child
 *   - stderr is forwarded to the parent's stderr so failures are visible
 *   - EADDRINUSE on the agent's port triggers a clear error message
 *
 * The agent binds `127.0.0.1:7601` by default; that matches
 * `AGENT_DEFAULT_HOST` / `AGENT_DEFAULT_PORT` in
 * `packages/agent/src/constants.ts` and the frontend probe in
 * `src/app/ai/chat/agent-transport.ts`. CORS is wired to the same
 * origin the dev server uses (passed in by the caller).
 *
 * Spawn uses `bun --watch packages/agent/src/start.ts` rather than
 * `node dist/start.mjs` so we don't require `bun --filter
 * @open-pencil/agent build` to have run first. The agent's own
 * `build:prompts` step must have produced `src/prompts/generated/`
 * (it has when the user has run `bun run agent:dev` even once, or
 * when `bun run build:packages` ran). If that file is missing, the
 * agent will exit with a module-not-found error visible in stderr.
 *
 * The `enabled` flag gates the entire plugin: pass `false` from
 * `vite build` to skip spawning — production builds don't need a
 * child process.
 */
export function agentPlugin(corsOrigin: string, enabled: boolean = true): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let starting: Promise<void> | null = null

  return {
    name: 'open-pencil-agent',
    async configureServer() {
      if (!enabled) return
      if (child || starting) return

      starting = (async () => {
        const childEnv = { ...process.env }
        // Don't inherit a leftover port override from the parent shell —
        // we always want the default 7601 unless an env override is
        // explicitly set in the operator's shell.
        delete childEnv.OPENPENCIL_AGENT_PORT
        delete childEnv.OPENPENCIL_AGENT_HOST
        delete childEnv.OPENPENCIL_AGENT_CORS_ORIGINS

        const spawned = spawn('bun', ['--watch', 'packages/agent/src/start.ts'], {
          stdio: ['ignore', 'inherit', 'pipe'],
          env: {
            ...childEnv,
            OPENPENCIL_AGENT_CORS_ORIGINS: corsOrigin
          }
        })
        child = spawned

        spawned.on('error', (err) => {
          console.error(`[agent] Failed to spawn agent backend: ${err.message}`)
          if (child === spawned) child = null
        })

        spawned.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          if (text.includes('EADDRINUSE')) {
            console.error(
              `\x1b[31m[agent] Agent bind failed (port 7601). Is another OpenPencil instance running?\x1b[0m`
            )
            spawned.kill()
            if (child === spawned) child = null
            return
          }
          process.stderr.write(data)
        })

        spawned.on('exit', (code) => {
          if (code && code !== 0) {
            console.error(`[agent] Agent backend exited with code ${code}`)
          }
          if (child === spawned) child = null
        })
      })()

      try {
        await starting
      } finally {
        starting = null
      }
    },
    async buildEnd() {
      if (starting) {
        try {
          await starting
        } catch {
          void 0
        }
      }
      child?.kill()
      child = null
      starting = null
    }
  }
}
