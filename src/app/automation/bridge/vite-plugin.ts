import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Plugin } from 'vite'

import { platformHasUnixSockets } from './server/paths'

interface AutomationEnvironmentOptions {
  authToken: string | null
  baseEnv: NodeJS.ProcessEnv
  corsOrigin: string
  discoveryPath: string | null
  httpPort: number
  socketPath: string | null
}

export function createAutomationEnvironment(
  options: AutomationEnvironmentOptions
): NodeJS.ProcessEnv {
  const { authToken, baseEnv, corsOrigin, discoveryPath, httpPort, socketPath } = options
  const childEnv = { ...baseEnv }
  delete childEnv.OPENPENCIL_MCP_SOCKET
  delete childEnv.OPENPENCIL_MCP_AUTH_TOKEN
  return {
    ...childEnv,
    PORT: String(httpPort),
    ...(socketPath ? { OPENPENCIL_MCP_SOCKET: socketPath } : {}),
    ...(discoveryPath ? { OPENPENCIL_MCP_DISCOVERY_PATH: discoveryPath } : {}),
    OPENPENCIL_MCP_AUTH_TOKEN: authToken ?? '',
    OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin
  }
}

const CHILD_EXIT_TIMEOUT_MS = 2_000

interface AutomationPluginOptions {
  browserURL: string
  corsOrigin: string
  httpPort: number
  portlessServiceName: string | null
  runtimeId: string
}

function safeRuntimeId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

// TODO: production — bundle the bridge as Tauri sidecar or spawn via shell plugin
export function automationPlugin(
  authToken: string | null,
  options: AutomationPluginOptions
): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let lifecycle = Promise.resolve()

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = lifecycle.then(operation, operation)
    lifecycle = next.catch(() => undefined)
    return next
  }

  async function stopChild(): Promise<void> {
    const running = child
    if (!running) return
    child = null
    const exited = new Promise<void>((resolve) => {
      running.once('exit', () => resolve())
    })
    running.kill()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(true), CHILD_EXIT_TIMEOUT_MS)
    })
    const exitedGracefully = await Promise.race([exited.then(() => false), timedOut])
    if (timeout) clearTimeout(timeout)
    if (!exitedGracefully && running.exitCode === null) {
      running.kill('SIGKILL')
      await exited
    }
  }

  async function startChild(): Promise<void> {
    const runtimeDir = join(tmpdir(), 'open-pencil-mcp', safeRuntimeId(options.runtimeId))
    await mkdir(runtimeDir, { recursive: true, mode: 0o700 })
    const socketPath = platformHasUnixSockets() ? join(runtimeDir, 'mcp.sock') : null
    const discoveryPath = join(runtimeDir, 'mcp.json')
    const command = ['bun', 'run', 'src/app/automation/bridge/server/index.ts']
    const spawnCommand = options.portlessServiceName ? 'portless' : command[0]
    const spawnArgs = options.portlessServiceName
      ? ['run', '--name', options.portlessServiceName, ...command]
      : command.slice(1)
    const spawned = spawn(spawnCommand, spawnArgs, {
      stdio: ['ignore', 'inherit', 'pipe'],
      env: createAutomationEnvironment({
        authToken,
        baseEnv: process.env,
        corsOrigin: options.corsOrigin,
        discoveryPath,
        httpPort: options.httpPort,
        socketPath
      })
    })
    child = spawned

    spawned.on('error', (err) => {
      console.error(`[automation] Failed to spawn bridge: ${err.message}`)
      if (child === spawned) child = null
    })

    spawned.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('EADDRINUSE')) {
        console.error(
          `\x1b[31m[automation] Bridge bind failed (${options.browserURL}${socketPath ? ` or socket ${socketPath}` : ''}). Is another OpenPencil instance running?\x1b[0m`
        )
        spawned.kill()
        if (child === spawned) child = null
        return
      }
      process.stderr.write(data)
    })

    spawned.on('exit', (code) => {
      if (code && code !== 0) console.error(`[automation] Bridge exited with code ${code}`)
      if (child === spawned) child = null
    })
  }

  return {
    name: 'open-pencil-automation',
    async configureServer() {
      await enqueue(startChild)
    },
    async buildEnd() {
      await enqueue(stopChild)
    }
  }
}
