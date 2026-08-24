/**
 * T24 prompt 四层装配冒烟（T24-plan §2 C1/C2/C3 的后端半 + manifest 路由）。
 *
 * 全程不需要真实 LLM key：
 *  - POST /api/pi/credentials 写 dummy key 过 pi 的 auth 预检（agent-session.js
 *    hasConfiguredAuth 拦截在 before_agent_start 之前——无 key 钩子根本不 fire）
 *  - 后端 env PI_PROMPT_PROBE_DIR=<tempRoot>/probe 开启探针 extension（登记在
 *    装配 extension 之后，runner 链式语义下 event.systemPrompt 即最终注入值，
 *    每 run 覆写 last-system-prompt.md）
 *  - provider 调用随后 401/断网失败无所谓——探针文件在 before_agent_start
 *    时已落盘；SSE 读到 error/finish 即收
 *
 * 断言：
 *  C1 ui 模式探针 == system-prompt.md byte 级原样；marketing = base + 工作流段
 *     + overlay（含 marketing 独有句式、不含 ui 独有的 Building top-down）
 *  C2 picked profile → Active style profile 段 + 种子 markdown；bogus id →
 *     re-pick 段；无种子后端 → fallback 段；ui 模式带 pickedProfileId 仍零 overlay
 *  C3 同 session 换 profile → 下一条 probe 反映新 overlay（不重建）；同 session
 *     切模式 → 驱逐重建（probe 回 ui 基底）且 index.json 映射/JSONL 文件不动
 *  路由 GET /api/pi/brand/manifest 形状 + 脱敏（无 markdown）+ 405
 *
 * 运行：bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs（仓根）
 */

import { spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..')
const PORT = 7910 + Math.floor(Math.random() * 200)
const BASE = `http://127.0.0.1:${PORT}`

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}${detail ? ` —— ${detail}` : ''}`)
  }
}

const UI_ONLY_MARKER = '## Building top-down (MANDATORY)'
const MARKETING_MARKER = '# Marketing Design Workflow (MANDATORY)'
const TYPES_MARKER = '## Material types in the current brand'
const PROFILE_MARKER = '## Active style profile:'

// ── fixture 布置：真实 prompt 段 + brand 种子复制进 tempRoot
function layoutRoot(withBrandSeed) {
  const tempRoot = mkdtempSync(join(tmpdir(), 't24-assembly-'))
  mkdirSync(join(tempRoot, 'src/app/ai/chat'), { recursive: true })
  mkdirSync(join(tempRoot, 'src/app/ai/pi-backend/prompts'), { recursive: true })
  copyFileSync(
    join(repoRoot, 'src/app/ai/chat/system-prompt.md'),
    join(tempRoot, 'src/app/ai/chat/system-prompt.md')
  )
  for (const f of ['system-prompt-base.md', 'system-prompt-marketing.md']) {
    copyFileSync(
      join(repoRoot, 'src/app/ai/pi-backend/prompts', f),
      join(tempRoot, 'src/app/ai/pi-backend/prompts', f)
    )
  }
  if (withBrandSeed) {
    mkdirSync(join(tempRoot, 'src/app/ai/pi-backend/brand'), { recursive: true })
    copyFileSync(
      join(repoRoot, 'src/app/ai/pi-backend/brand/config.yaml'),
      join(tempRoot, 'src/app/ai/pi-backend/brand/config.yaml')
    )
  }
  mkdirSync(join(tempRoot, 'probe'), { recursive: true })
  return tempRoot
}

const tempRoot = layoutRoot(true)
const emptySeedRoot = layoutRoot(false)
const uiBase = readFileSync(join(repoRoot, 'src/app/ai/chat/system-prompt.md'), 'utf8')
// pi buildSystemPrompt 固有尾巴（T21 起即如此，非 T24 引入）：自定义 systemPrompt
// 之后追加 `\nCurrent working directory: <cwd>\n`（正斜杠规范化）。
// 「byte 级原样」的精确口径 = 文件字节 + 该尾巴
const cwdSuffix = (root) => `\nCurrent working directory: ${root.replaceAll('\\', '/')}\n`
const uiBaseWithCwd = uiBase + cwdSuffix(tempRoot)

// ── 起后端（显式剔除真实 key 防环境泄漏干扰；dummy key 经凭据路由写入）
const backendEnv = {
  ...process.env,
  OPENPENCIL_PI_BACKEND_PORT: String(PORT),
  PI_PROMPT_PROBE_DIR: join(tempRoot, 'probe')
}
delete backendEnv.OPENROUTER_API_KEY
const backend = spawn('bun', ['run', join(repoRoot, 'src/app/ai/pi-backend/main.ts')], {
  cwd: tempRoot,
  env: backendEnv,
  stdio: ['ignore', 'pipe', 'pipe']
})
let backendExited = false
backend.on('exit', () => {
  backendExited = true
})
backend.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`))

// 无种子后端（fallback 断言）：同仓库代码、另一端口、另一 rootDir
const PORT2 = PORT + 500 > 7989 ? PORT - 500 : PORT + 500
const BASE2 = `http://127.0.0.1:${PORT2}`
const backendEnv2 = {
  ...process.env,
  OPENPENCIL_PI_BACKEND_PORT: String(PORT2),
  PI_PROMPT_PROBE_DIR: join(emptySeedRoot, 'probe')
}
delete backendEnv2.OPENROUTER_API_KEY
const backend2 = spawn('bun', ['run', join(repoRoot, 'src/app/ai/pi-backend/main.ts')], {
  cwd: emptySeedRoot,
  env: backendEnv2,
  stdio: ['ignore', 'pipe', 'pipe']
})
let backend2Exited = false
backend2.on('exit', () => {
  backend2Exited = true
})
backend2.stderr.on('data', (d) => process.stderr.write(`[backend2] ${d}`))

async function waitHealth(base, exited) {
  for (let i = 0; i < 60; i++) {
    if (exited()) return false
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return true
    } catch {
      // 未就绪
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/** POST /api/pi-chat 并排空 SSE（provider 失败=预期；30s 竞时兜底防挂死） */
async function sendPrompt(base, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(`${base}/api/pi-chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    if (!res.ok || !res.body) return `HTTP ${res.status}`
    const reader = res.body.getReader()
    for (;;) {
      const { done } = await reader.read()
      if (done) break
    }
    return 'done'
  } catch (error) {
    return `aborted: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    clearTimeout(timer)
  }
}

function probeText(root) {
  const file = join(root, 'probe', 'last-system-prompt.md')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function userMessage(text) {
  return [{ role: 'user', parts: [{ type: 'text', text }] }]
}

try {
  check('后端就绪（种子后端 + 无种子后端）', (await waitHealth(BASE, () => backendExited)) && (await waitHealth(BASE2, () => backend2Exited)))

  // ── manifest 路由
  const manifestRes = await fetch(`${BASE}/api/pi/brand/manifest`)
  const manifest = await manifestRes.json()
  check('路由 manifest：200 + 种子名称', manifestRes.ok && manifest.name === '默认品牌库', JSON.stringify(manifest).slice(0, 120))
  check(
    '路由 manifest：types 七条齐（wechat_moments 等）',
    Array.isArray(manifest.types) && manifest.types.length === 7 &&
      manifest.types.some((t) => t.id === 'wechat_moments' && t.label === '朋友圈广告')
  )
  check(
    '路由 manifest：profiles 含 casual_v1 且带 applicableTo',
    Array.isArray(manifest.profiles) &&
      manifest.profiles.some((p) => p.id === 'casual_v1' && p.label === '休闲活泼' && Array.isArray(p.applicableTo))
  )
  check(
    '路由 manifest：脱敏——任何 profile 不带 markdown 正文',
    Array.isArray(manifest.profiles) && manifest.profiles.every((p) => !('markdown' in p))
  )
  const manifest405 = await fetch(`${BASE}/api/pi/brand/manifest`, { method: 'POST' })
  check('路由 manifest：非 GET → 405', manifest405.status === 405)
  const emptyManifest = await (await fetch(`${BASE2}/api/pi/brand/manifest`)).json()
  check(
    '路由 manifest：无种子后端 → 空 types/profiles 降级',
    Array.isArray(emptyManifest.types) && emptyManifest.types.length === 0 &&
      Array.isArray(emptyManifest.profiles) && emptyManifest.profiles.length === 0
  )

  // ── dummy 凭据过 auth 预检（写 tempRoot 自带 agentDir，不碰真实 .openpencil）
  const cred = await fetch(`${BASE}/api/pi/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerId: 'openrouter', apiKey: 'sk-t24-probe-dummy' })
  })
  check('前置：dummy 凭据写入（过 auth 预检用）', cred.ok)
  const cred2 = await fetch(`${BASE2}/api/pi/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerId: 'openrouter', apiKey: 'sk-t24-probe-dummy' })
  })
  check('前置：无种子后端 dummy 凭据写入', cred2.ok)

  // ── C1a：ui 模式 → 探针 == system-prompt.md byte 级原样
  await sendPrompt(BASE, { sessionId: 't24-probe-ui', messages: userMessage('probe ui'), chatMode: 'ui' })
  const uiProbe = probeText(tempRoot)
  check('C1 ui：探针落盘', uiProbe !== null)
  check(
    'C1 ui：与 system-prompt.md byte 级一致（零 marketing 零 overlay；pi 固有 cwd 尾巴除外）',
    uiProbe === uiBaseWithCwd,
    uiProbe === null ? 'probe missing' : `len ${uiProbe.length} vs base ${uiBaseWithCwd.length}`
  )

  // ── C1b：marketing 模式 → base + 工作流段 + overlay（types 段恒在）
  await sendPrompt(BASE, { sessionId: 't24-probe-mkt', messages: userMessage('probe marketing'), chatMode: 'marketing' })
  const mktProbe = probeText(tempRoot) ?? ''
  check('C1 marketing：含工作流段独有句式', mktProbe.includes(MARKETING_MARKER))
  check('C1 marketing：含 overlay types 段（未 picked 也恒在）', mktProbe.includes(TYPES_MARKER))
  check('C1 marketing：含种子 type 条目（wechat_moments）', mktProbe.includes('- wechat_moments (朋友圈广告)'))
  check('C1 marketing：不含 ui 基底独有句式', !mktProbe.includes(UI_ONLY_MARKER))
  check('C2 marketing 未 picked：无 Active style profile 段', !mktProbe.includes(PROFILE_MARKER))

  // ── C2：picked profile → profile 段 + 种子 markdown 注入
  await sendPrompt(BASE, {
    sessionId: 't24-probe-mkt',
    messages: userMessage('probe picked'),
    chatMode: 'marketing',
    pickedProfileId: 'casual_v1'
  })
  const pickedProbe = probeText(tempRoot) ?? ''
  check('C2 picked：含 Active style profile: casual_v1 段', pickedProbe.includes(`${PROFILE_MARKER} casual_v1`))
  check('C2 picked：含种子 profile markdown 正文（休闲活泼风格）', pickedProbe.includes('# 休闲活泼风格'))

  // ── C3a：同 session 换 profile（不重建）→ 下一条 probe 反映新 overlay
  await sendPrompt(BASE, {
    sessionId: 't24-probe-mkt',
    messages: userMessage('probe re-pick'),
    chatMode: 'marketing',
    pickedProfileId: 'watercolor_poster_v3'
  })
  const repickProbe = probeText(tempRoot) ?? ''
  check(
    'C3 同 session 换 profile：下一条 probe 即新 overlay（水彩海报 v3）',
    repickProbe.includes(`${PROFILE_MARKER} watercolor_poster_v3`) && repickProbe.includes('# 水彩海报')
  )

  // ── C2：bogus profile id → re-pick 提示段
  await sendPrompt(BASE, {
    sessionId: 't24-probe-mkt',
    messages: userMessage('probe bogus'),
    chatMode: 'marketing',
    pickedProfileId: 'bogus_profile'
  })
  const bogusProbe = probeText(tempRoot) ?? ''
  check(
    'C2 bogus id：输出 (not in brand config) re-pick 段',
    bogusProbe.includes(`${PROFILE_MARKER} (not in brand config)`) && bogusProbe.includes('bogus_profile')
  )

  // ── C3b：同 session 切模式 → 驱逐重建（probe 回 ui 基底），index/JSONL 不动
  const indexPath = join(tempRoot, '.openpencil', 'pi-sessions', 'index.json')
  const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  const fileBefore = indexBefore ? (JSON.parse(indexBefore)['t24-probe-mkt']?.file ?? null) : null
  check('C3 前置：marketing session 已落盘 index', typeof fileBefore === 'string' && existsSync(fileBefore))
  const jsonlBefore = fileBefore && existsSync(fileBefore) ? readFileSync(fileBefore, 'utf8') : ''
  await sendPrompt(BASE, { sessionId: 't24-probe-mkt', messages: userMessage('probe switched to ui'), chatMode: 'ui' })
  const switchedProbe = probeText(tempRoot) ?? ''
  check('C3 模式切换：probe 回 ui 基底 byte 级一致（驱逐重建携带新 base）', switchedProbe === uiBaseWithCwd)
  const indexAfter = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  check(
    'C3 模式切换：index.json 映射不动（同 sessionId 同文件）',
    indexAfter === indexBefore,
    'index.json changed'
  )
  const jsonlAfter = fileBefore && existsSync(fileBefore) ? readFileSync(fileBefore, 'utf8') : ''
  check(
    'C3 模式切换：JSONL 历史保留且追加（文件增长不回撤）',
    jsonlAfter.length >= jsonlBefore.length && jsonlAfter.startsWith(jsonlBefore.slice(0, Math.min(200, jsonlBefore.length)))
  )

  // ── C2：ui 模式带 pickedProfileId → 注册表 acceptsProfile=false，零 overlay
  await sendPrompt(BASE, {
    sessionId: 't24-probe-ui-profile',
    messages: userMessage('probe ui with profile'),
    chatMode: 'ui',
    pickedProfileId: 'casual_v1'
  })
  const uiProfileProbe = probeText(tempRoot) ?? ''
  check('C2 ui 模式忽略 pickedProfileId：仍与基底 byte 级一致', uiProfileProbe === uiBaseWithCwd)

  // ── C2：无种子后端 → fallback 引导段
  await sendPrompt(BASE2, { sessionId: 't24-probe-empty', messages: userMessage('probe empty seed'), chatMode: 'marketing' })
  const emptyProbe = probeText(emptySeedRoot) ?? ''
  check('C2 无种子：overlay 输出 fallback 引导段', emptyProbe.includes('No material types available'))
  check('C2 无种子：工作流段仍在（种子缺失只降级 overlay）', emptyProbe.includes(MARKETING_MARKER))
} finally {
  // Windows 清理纪律：kill() 后 killed 标志立即置位（不代表进程已退），
  // 必须等 exit 事件；rmSync 对句柄释放滞后做有限重试
  const { once } = await import('node:events')
  const stop = async (proc) => {
    if (!proc.pid || proc.exitCode !== null) return
    proc.kill('SIGTERM')
    await Promise.race([once(proc, 'exit'), new Promise((r) => setTimeout(r, 2000))])
    if (proc.exitCode === null) {
      try {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore' })
      } catch {
        // 已退出
      }
      await Promise.race([once(proc, 'exit'), new Promise((r) => setTimeout(r, 2000))])
    }
  }
  await stop(backend)
  await stop(backend2)
  for (const dir of [tempRoot, emptySeedRoot]) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        rmSync(dir, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
