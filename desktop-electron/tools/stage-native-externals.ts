/**
 * P2 打包链——把 NATIVE_EXTERNALS（yoga-layout / photon-node / clipboard）三
 * 个 npm 包从 node_modules 复制到 desktop-electron/native-externals/，供
 * electron-builder extraResources 平铺到 resources/app/native-externals/。
 *
 * **不在仓库追踪**——这些是 vendored 二进制（photon_rs_bg.wasm 等），
 * 升级 npm 时跑本脚本刷新。.gitignore 已排除 desktop-electron/native-
 * externals/。
 */
import { existsSync, mkdirSync, cpSync, rmSync, readlinkSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const bunNodeModules = join(projectRoot, 'node_modules', '.bun', 'node_modules')

interface ExternalsEntry {
  readonly from: string
  readonly to: string
}

const ENTRIES: readonly ExternalsEntry[] = [
  // yoga-layout：package.json 里通过 npm: 改名 @open-pencil/yoga-layout（仓内
  // 复刻版，3.3.0-grid.3）；.bun/node_modules 下是 .bun/@open-pencil+yoga-layout@.../
  // 形式存的真实包名（含 + 锁标记），不能直接 join 拼
  { from: join(bunNodeModules, '@open-pencil', 'yoga-layout'), to: 'yoga-layout' },
  { from: join(bunNodeModules, '@silvia-odwyer', 'photon-node'), to: '@silvia-odwyer/photon-node' },
  { from: join(bunNodeModules, '@mariozechner', 'clipboard'), to: '@mariozechner/clipboard' },
  { from: join(bunNodeModules, '@mariozechner', 'clipboard-win32-x64-msvc'), to: '@mariozechner/clipboard-win32-x64-msvc' }
]

const stagingDir = join(projectRoot, 'desktop-electron', 'native-externals')

function resolveBunLink(source: string): string {
  const stat = statSync(source, { throwIfNoEntry: false })
  if (!stat) throw new Error(`源不存在：${source}（bun install 还没跑？）`)
  if (stat.isSymbolicLink()) return resolveBunLink(resolve(dirname(source), readlinkSync(source)))
  return source
}

function stage(): void {
  if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true })
  mkdirSync(stagingDir, { recursive: true })

  for (const entry of ENTRIES) {
    if (!existsSync(entry.from)) {
      throw new Error(`NATIVE_EXTERNAL 源缺失：${entry.from}`)
    }
    const realSource = resolveBunLink(entry.from)
    const target = join(stagingDir, entry.to)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(realSource, target, { recursive: true, dereference: true })
    console.log(`[stage] ${entry.from} -> ${target}`)
  }
  console.log(`[stage] 完成：${stagingDir}`)
}

stage()