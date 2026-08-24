/**
 * T22 历史回填 + 会话族谱冒烟（T22-plan D2/D3，验收 A1/A3/A6 的后端半）。
 *
 * 全程不需要 LLM key：会话族谱由真实 pi JSONL（仓内 .openpencil/pi-sessions
 * 实测 v3 文件，含 toolCall/toolResult）+ 合成 index.json 键构造，直接打
 * GET /api/pi/history 验证：
 *  ① docKey 前缀解析族内最新会话（时间戳后缀字典序）
 *  ② 历史回填内容保真（user/assistant 文本 + 工具卡片折叠，reasoning 不回填）
 *  ③ sessionId 精确读取
 *  ④ 异族/未知前缀隔离
 *  ⑤ GET 全程只读（index.json 内容不变）
 *
 * 运行：bun spikes/s-pi/backend-smoke/t22/history-smoke.mjs（仓根）
 */

import { spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..')
// 随机端口：固定端口曾被上一次崩溃残留的孤儿后端占用，健康检查误打旧实例
const PORT = 7710 + Math.floor(Math.random() * 200)
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

// ── ① fixture：真实 pi JSONL（A 族两个会话 + B 族一个）
const liveDir = join(repoRoot, '.openpencil', 'pi-sessions')
check('前置：仓内已有真实 pi 会话文件', existsSync(liveDir))
const allJsonl = existsSync(liveDir)
  ? readdirSync(liveDir).filter((f) => f.endsWith('.jsonl'))
  : []
const withTools = allJsonl
  .filter((f) => readFileSync(join(liveDir, f), 'utf8').includes('"type":"toolCall"'))
  .sort()
const withUser = allJsonl
  .filter((f) => readFileSync(join(liveDir, f), 'utf8').includes('"role":"user"'))
  .sort()

const fileA2 = withTools[0] // A 族新会话（含工具调用）
const fileA1 = withUser.find((f) => f !== fileA2) // A 族旧会话
const fileB = withUser.find((f) => f !== fileA2 && f !== fileA1) // B 族
check('前置：fixture 齐（A2 含 toolCall，A1/B 含 user 消息）', Boolean(fileA2 && fileA1 && fileB))

function firstUserText(file) {
  for (const line of readFileSync(join(liveDir, file), 'utf8').split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line)
    if (entry.type !== 'message' || entry.message?.role !== 'user') continue
    const content = entry.message.content
    const text =
      typeof content === 'string'
        ? content
        : (content ?? [])
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('\n')
    if (text.trim()) return text
  }
  return null
}

function firstToolName(file) {
  for (const line of readFileSync(join(liveDir, file), 'utf8').split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line)
    if (entry.type !== 'message') continue
    for (const part of entry.message?.content ?? []) {
      if (part.type === 'toolCall' && part.name) return part.name
    }
  }
  return null
}

const a1User = fileA1 ? firstUserText(fileA1) : null
const a2User = fileA2 ? firstUserText(fileA2) : null
const a2Tool = fileA2 ? firstToolName(fileA2) : null
const bUser = fileB ? firstUserText(fileB) : null

// ── ② 临时 rootDir + 合成会话族谱
const tempRoot = mkdtempSync(join(tmpdir(), 't22-history-'))
const sessionsDir = join(tempRoot, '.openpencil', 'pi-sessions')
mkdirSync(sessionsDir, { recursive: true })
// system-prompt.md：service 读盘需要（本冒烟不触发 prompt，仅为启动完整）
mkdirSync(join(tempRoot, 'src/app/ai/chat'), { recursive: true })
copyFileSync(
  join(repoRoot, 'src/app/ai/chat/system-prompt.md'),
  join(tempRoot, 'src/app/ai/chat/system-prompt.md')
)

for (const f of [fileA1, fileA2, fileB]) copyFileSync(join(liveDir, f), join(sessionsDir, f))

const PREFIX_A = `doc-${'a'.repeat(40)}`
const PREFIX_B = `doc-${'b'.repeat(40)}`
const SID_A1 = `${PREFIX_A}-20260823T100000Z`
const SID_A2 = `${PREFIX_A}-20260823T110000Z`
const SID_B = `${PREFIX_B}-20260823T120000Z`
const index = {
  [SID_A1]: { file: join(sessionsDir, fileA1) },
  [SID_A2]: { file: join(sessionsDir, fileA2) },
  [SID_B]: { file: join(sessionsDir, fileB) },
  // 异构旧键：前缀过滤不得误捕
  'smoke-legacy-unrelated': { file: join(sessionsDir, fileA1) }
}
writeFileSync(join(sessionsDir, 'index.json'), JSON.stringify(index, null, 2))
const indexBefore = readFileSync(join(sessionsDir, 'index.json'), 'utf8')

// ── ③ 起后端（无 LLM 调用，env 无需 key；显式剔除防环境泄漏干扰）
const backendEnv = { ...process.env, OPENPENCIL_PI_BACKEND_PORT: String(PORT) }
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

async function waitHealth() {
  for (let i = 0; i < 60; i++) {
    if (backendExited) return false // 启动即死（如端口占用），不误打别的实例
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return true
    } catch {
      // 未就绪
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function getHistory(query) {
  const res = await fetch(`${BASE}/api/pi/history?${query}`)
  return { status: res.status, body: await res.json() }
}

try {
  check('后端就绪', await waitHealth())

  // ── ④ 断言
  const latest = await getHistory(`docKey=${PREFIX_A}`)
  check('① docKey 前缀解析回族内最新 sessionId', latest.body.sessionId === SID_A2)

  const texts = (latest.body.messages ?? [])
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
  check('② 回填含 A2 用户消息文本', Boolean(a2User && texts.includes(a2User.slice(0, 30))))

  const toolParts = (latest.body.messages ?? [])
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === `tool-${a2Tool}`)
  check('② 工具卡片折叠（tool-<name> part 存在）', toolParts.length > 0)
  check(
    '② 工具结果折叠为 output-available 且带 output',
    toolParts.some((p) => p.state === 'output-available' && p.output != null)
  )
  check(
    '② reasoning 不回填',
    !(latest.body.messages ?? [])
      .flatMap((m) => m.parts ?? [])
      .some((p) => p.type === 'reasoning')
  )

  const exact = await getHistory(`sessionId=${SID_A1}`)
  const exactTexts = (exact.body.messages ?? [])
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
  check(
    '③ sessionId 精确读取 A1 历史',
    exact.body.sessionId === SID_A1 && Boolean(a1User && exactTexts.includes(a1User.slice(0, 30)))
  )

  const other = await getHistory(`docKey=${PREFIX_B}`)
  const otherTexts = (other.body.messages ?? [])
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
  check(
    '④ B 族解析到 B 会话且不含 A 内容',
    other.body.sessionId === SID_B &&
      Boolean(bUser && otherTexts.includes(bUser.slice(0, 30))) &&
      !(a2User && otherTexts.includes(a2User.slice(0, 30)))
  )

  const none = await getHistory(`docKey=doc-${'z'.repeat(40)}`)
  check(
    '④ 未知前缀 → 空族（sessionId null + messages []）',
    none.body.sessionId === null && none.body.messages?.length === 0
  )

  check(
    '⑤ GET 全程只读（index.json 内容不变）',
    readFileSync(join(sessionsDir, 'index.json'), 'utf8') === indexBefore
  )
} finally {
  // Windows：bun run 会再起子进程，进程树退出 + cwd 句柄释放都有延迟——
  // kill 树（taskkill /T）→ 等 exit（3s 兜底）→ 额外等待 → rmSync 重试
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    backend.kill('SIGTERM')
  }
  await new Promise((resolve) => {
    backend.once('exit', resolve)
    setTimeout(resolve, 3000)
  })
  await new Promise((r) => setTimeout(r, 500))
  rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
