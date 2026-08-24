/**
 * T20 pi 后端进程入口（独立 bun 进程）。
 *
 * 启动方式：
 *  - dev：vite 插件 spawn 子进程（../vite-plugin.ts，env 继承 + 端口注入）
 *  - 独立：`bun run dev:backend`
 *
 * 环境变量：
 *  - OPENPENCIL_PI_BACKEND_PORT：监听端口（默认 7700，见 server.ts）
 *  - OPENROUTER_API_KEY：模型 key。T25 D3：缺失时自动读 .openpencil/key-env
 *    自助注入（shell 脚本 source 不再是前置条件）；仍缺则 service 在首个
 *    prompt 处如实报错。key 只注入 process.env，不打印不落日志。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createPiBackendServer, PI_BACKEND_DEFAULT_PORT } from './server'

const rootDir = process.cwd()

// T25 D3：key-env 自助注入（仅补缺失项，不覆盖已有 env）
function injectKeyEnv(): void {
  if (process.env.OPENROUTER_API_KEY) return
  const keyEnvPath = join(rootDir, '.openpencil', 'key-env')
  if (!existsSync(keyEnvPath)) return
  for (const line of readFileSync(keyEnvPath, 'utf-8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const [, name, rawValue] = match
    if (process.env[name]) continue
    const value = rawValue.replace(/^["']|["']$/g, '')
    if (value) process.env[name] = value
  }
}

injectKeyEnv()

const port = Number(process.env.OPENPENCIL_PI_BACKEND_PORT ?? PI_BACKEND_DEFAULT_PORT)

const server = createPiBackendServer({ rootDir })

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[pi-backend] 端口 ${port} 已被占用——是否有另一个 pi 后端实例在运行？` +
        `（可用 OPENPENCIL_PI_BACKEND_PORT 换端口）`
    )
  } else {
    console.error(`[pi-backend] 启动失败：${error.message}`)
  }
  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  console.error(`[pi-backend] listening on http://127.0.0.1:${port} (pid ${process.pid})`)
})

function shutdown() {
  server.close(() => process.exit(0))
  // 兜底：长连接未排空时 2s 后强退
  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
