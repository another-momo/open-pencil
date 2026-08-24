/**
 * T20 vite 插件：pi 后端进程管理器（owner 拍板 2026-08-23：后端是独立进程）。
 *
 * 形态照抄 automation 桥（src/app/automation/bridge/vite-plugin.ts，2026-08-23
 * 实证）：configureServer spawn `bun run src/app/ai/pi-backend/main.ts` 子进程，
 * buildEnd 回收（kill + 超时 SIGKILL 兜底）；/api/pi-chat 经 config() hook 注入
 * server.proxy 转发到后端端口——前端 transport 保持同源调用零改动。
 *
 * OPENROUTER_API_KEY 经 env 继承进入后端进程；缺 key 时后端自助读
 * .openpencil/key-env 注入（main.ts，T25 D3），仍缺则 service 在首个 prompt
 * 处如实报错（不阻断 vite 启动）。
 */

import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

import { PI_BACKEND_DEFAULT_PORT } from './config'

const CHILD_EXIT_TIMEOUT_MS = 2_000
const HEALTH_TIMEOUT_MS = 15_000
const HEALTH_INTERVAL_MS = 150

export function piBackendPlugin(): Plugin {
  const port = Number(process.env.OPENPENCIL_PI_BACKEND_PORT ?? PI_BACKEND_DEFAULT_PORT)
  let child: ReturnType<typeof spawn> | null = null

  async function stopChild(): Promise<void> {
    const running = child
    child = null
    if (running?.exitCode !== null) return
    // 经函数读 exitCode：属性收窄会把 exitCode 定死在 null（type-aware lint 实证），
    // 函数调用每次取实时值
    const hasExited = () => running.exitCode !== null
    running.kill()
    // 轮询等优雅退出，超时 SIGKILL 兜底
    const deadline = Date.now() + CHILD_EXIT_TIMEOUT_MS
    while (!hasExited() && Date.now() < deadline) {
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })
    }
    if (!hasExited()) running.kill('SIGKILL')
  }

  async function waitForHealth(spawned: ReturnType<typeof spawn>): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS
    while (Date.now() < deadline) {
      // 直接读子进程 exitCode 而非自维 flag（回调内赋值对 TS 收窄不可见，type-aware lint 实证）
      if (spawned.exitCode !== null) return // 启动失败信息已由 stderr 透传，不再重复报错
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`)
        if (res.ok) {
          console.error(`[pi-backend] ready (http://127.0.0.1:${port})`)
          return
        }
        // oxlint-disable-next-line open-pencil/no-silent-catch -- 轮询中的拒绝连接即「未就绪」，无需记录
      } catch {
        // 尚未就绪，继续等
      }
      await new Promise((resolve) => {
        setTimeout(resolve, HEALTH_INTERVAL_MS)
      })
    }
    console.warn(`[pi-backend] ${HEALTH_TIMEOUT_MS}ms 内未等到 /health 就绪（端口 ${port}）`)
  }

  return {
    name: 'openpencil-pi-backend',
    apply: 'serve',
    config() {
      return {
        server: {
          proxy: {
            // T21：前缀从 /api/pi-chat 扩到 /api/pi（catalog/credentials/providers
            // 管理端点同走后端；/api/pi-chat 含于前缀内，前端零改动）
            '/api/pi': {
              target: `http://127.0.0.1:${port}`,
              changeOrigin: false
            }
          }
        }
      }
    },
    configureServer() {
      const spawned = spawn('bun', ['run', 'src/app/ai/pi-backend/main.ts'], {
        stdio: ['ignore', 'inherit', 'pipe'],
        env: { ...process.env, OPENPENCIL_PI_BACKEND_PORT: String(port) }
      })
      child = spawned

      spawned.on('error', (err) => {
        console.error(`[pi-backend] 无法 spawn 后端进程：${err.message}`)
        if (child === spawned) child = null
      })
      spawned.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data)
      })
      spawned.on('exit', (code) => {
        if (code && code !== 0) console.error(`[pi-backend] 后端进程退出，code=${code}`)
        if (child === spawned) child = null
      })

      void waitForHealth(spawned)
    },
    async buildEnd() {
      await stopChild()
    }
  }
}
