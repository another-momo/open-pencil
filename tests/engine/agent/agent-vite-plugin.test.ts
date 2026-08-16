import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

/**
 * The agent vite plugin is exercised in two ways:
 *   1. The plugin contract — its `configureServer` spawns the agent
 *      backend with the right args / env, forwards stderr, and its
 *      `buildEnd` kills the child.
 *   2. The no-op mode — when `enabled=false` (production build), it
 *      must not spawn anything.
 *
 * We mock `node:child_process` so the test never actually launches a
 * bun process. The mock records each spawn call AND keeps a reference
 * to the last fake child so stderr / kill tests can drive the same
 * child the plugin captured in its closure.
 */

type SpawnCall = {
  command: string
  args: string[]
  options: {
    stdio: Array<'ignore' | 'inherit' | 'pipe'>
    env: Record<string, string | undefined>
  }
}

const calls: SpawnCall[] = []
let lastChild:
  | (EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean })
  | null = null

function makeFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: () => boolean
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = () => true
  return child
}

mock.module('node:child_process', () => ({
  spawn: (command: string, args: string[], options: SpawnCall['options']) => {
    const child = makeFakeChild()
    calls.push({ command, args, options })
    lastChild = child
    return child
  }
}))

// Import AFTER the mock so the plugin captures the mocked `spawn`.
const { agentPlugin } = await import('@/app/automation/bridge/agent-vite-plugin')

const originalEnv = { ...process.env }

afterEach(() => {
  calls.length = 0
  lastChild = null
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

beforeEach(() => {
  calls.length = 0
  lastChild = null
})

describe('agentPlugin (production-build no-op)', () => {
  test('does not spawn when enabled=false', async () => {
    const plugin = agentPlugin('http://localhost:1420', false)
    expect(plugin.name).toBe('open-pencil-agent')
    await plugin.configureServer?.(undefined as never)
    expect(calls).toHaveLength(0)
  })
})

describe('agentPlugin (dev mode)', () => {
  test('spawns `bun --watch packages/agent/src/start.ts`', async () => {
    const plugin = agentPlugin('http://localhost:1420', true)
    await plugin.configureServer?.(undefined as never)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.command).toBe('bun')
    expect(calls[0]!.args).toEqual(['--watch', 'packages/agent/src/start.ts'])
  })

  test('forwards the dev server origin as CORS env', async () => {
    const plugin = agentPlugin('http://192.168.1.10:1420', true)
    await plugin.configureServer?.(undefined as never)

    expect(calls[0]!.options.env.OPENPENCIL_AGENT_CORS_ORIGINS).toBe('http://192.168.1.10:1420')
  })

  test('uses pipe stderr (inherit stdout) so failures surface in Vite logs', async () => {
    const plugin = agentPlugin('http://localhost:1420', true)
    await plugin.configureServer?.(undefined as never)

    expect(calls[0]!.options.stdio).toEqual(['ignore', 'inherit', 'pipe'])
  })

  test('forwards non-error stderr through the parent', async () => {
    const writes: string[] = []
    const originalWrite = process.stderr.write.bind(process.stderr)
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
      return true
    }) as typeof process.stderr.write

    try {
      const plugin = agentPlugin('http://localhost:1420', true)
      await plugin.configureServer?.(undefined as never)

      lastChild!.stderr.emit('data', Buffer.from('[openpencil-agent] listening on :7601'))
      expect(writes.some((w) => w.includes('listening on :7601'))).toBe(true)
    } finally {
      process.stderr.write = originalWrite
    }
  })

  test('EADDRINUSE on stderr kills the child and prints a friendly hint', async () => {
    const originalConsoleError = console.error
    const errorLines: string[] = []
    console.error = (...args: unknown[]) => {
      errorLines.push(args.map(String).join(' '))
    }

    try {
      const plugin = agentPlugin('http://localhost:1420', true)
      await plugin.configureServer?.(undefined as never)

      let killed = false
      lastChild!.kill = () => {
        killed = true
        return true
      }

      lastChild!.stderr.emit(
        'data',
        Buffer.from('Error: listen EADDRINUSE: address already in use :::7601')
      )
      expect(killed).toBe(true)
      expect(errorLines.some((l) => l.includes('Agent bind failed'))).toBe(true)
    } finally {
      console.error = originalConsoleError
    }
  })

  test('non-zero exit code logs the failure', async () => {
    const originalConsoleError = console.error
    const errorLines: string[] = []
    console.error = (...args: unknown[]) => {
      errorLines.push(args.map(String).join(' '))
    }

    try {
      const plugin = agentPlugin('http://localhost:1420', true)
      await plugin.configureServer?.(undefined as never)

      lastChild!.emit('exit', 1)
      expect(errorLines.some((l) => l.includes('exited with code 1'))).toBe(true)
    } finally {
      console.error = originalConsoleError
    }
  })

  test('zero exit code is silent (clean shutdown)', async () => {
    const originalConsoleError = console.error
    const errorLines: string[] = []
    console.error = (...args: unknown[]) => {
      errorLines.push(args.map(String).join(' '))
    }

    try {
      const plugin = agentPlugin('http://localhost:1420', true)
      await plugin.configureServer?.(undefined as never)

      lastChild!.emit('exit', 0)
      expect(errorLines).toHaveLength(0)
    } finally {
      console.error = originalConsoleError
    }
  })
})

describe('agentPlugin (buildEnd)', () => {
  test('kills the spawned child on buildEnd', async () => {
    const plugin = agentPlugin('http://localhost:1420', true)
    await plugin.configureServer?.(undefined as never)

    let killed = false
    lastChild!.kill = () => {
      killed = true
      return true
    }

    await plugin.buildEnd?.()
    expect(killed).toBe(true)
  })

  test('buildEnd without configureServer is a no-op', async () => {
    const plugin = agentPlugin('http://localhost:1420', true)
    await plugin.buildEnd?.()
    expect(calls).toHaveLength(0)
  })
})
