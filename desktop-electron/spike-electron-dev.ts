/**
 * spike-electron-spike：L3「真窗口 + sidecar 全家桶」启动器。
 *
 * 为什么是 bun 包装而不是 shell：
 *   - 跨平台：Windows cmd / PowerShell / bash 三套 env 注入语法不一致，
 *     bun 里统一用 process.env 赋值最稳；
 *   - 端口/产物存在性校验放一处：dist-main/main.mjs 缺失时直接 fail-fast，
 *     提示先跑 spike:electron:build，省一次手动排错。
 *
 * 仅设 OPENPENCIL_SHOW=1——其余 env（端口 / token / rootDir）由 main.ts 内
 * randomPort + 内部 randomBytes 自举；不开 L3 想另起 sidecar 调试口时自己加
 * env 即可（OPENPENCIL_BRIDGE_PORT / OPENPENCIL_PI_BACKEND_PORT_ELECTRON
 * / OPENPENCIL_LOOPBACK_PORT / OPENPENCIL_ROOT_DIR）。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const mainBundle = resolve(here, 'dist-main', 'main.mjs')
if (!existsSync(mainBundle)) {
  throw new Error(`main bundle 缺失：${mainBundle}——先跑 bun run spike:electron:build`)
}

const electronExe = resolve(root, 'node_modules', 'electron', 'dist', 'electron.exe')
if (!existsSync(electronExe)) {
  throw new Error(`electron 二进制缺失：${electronExe}`)
}

const child = spawn(electronExe, [mainBundle, '--no-sandbox', '--disable-gpu'], {
  cwd: root,
  env: {
    ...process.env,
    OPENPENCIL_SHOW: '1'
  },
  stdio: 'inherit'
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
process.on('SIGINT', () => { child.kill('SIGINT') })
process.on('SIGTERM', () => { child.kill('SIGTERM') })