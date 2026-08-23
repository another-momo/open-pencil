/**
 * T20 pi 后端进程入口（独立 bun 进程）。
 *
 * 启动方式：
 *  - dev：vite 插件 spawn 子进程（../vite-plugin.ts，env 继承 + 端口注入）
 *  - 独立：`bun run dev:backend`（需自行 source .openpencil/key-env 注入 key）
 *
 * 环境变量：
 *  - OPENPENCIL_PI_BACKEND_PORT：监听端口（默认 7700，见 server.ts）
 *  - OPENROUTER_API_KEY：模型 key（缺失时 service 在首个 prompt 处如实报错）
 */

import { createPiBackendServer, PI_BACKEND_DEFAULT_PORT } from './server'

const port = Number(process.env.OPENPENCIL_PI_BACKEND_PORT ?? PI_BACKEND_DEFAULT_PORT)
const rootDir = process.cwd()

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
