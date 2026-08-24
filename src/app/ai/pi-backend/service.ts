/**
 * T19 pi 后端 service：pi SDK 库形态薄封装（D21：不经 harness，直用
 * @earendil-works/pi-coding-agent 库 API）。
 *
 * 职责：
 *  - tab 级 session 池：sessionId → AgentSession，提示按 session 串行
 *  - SessionManager JSONL 持久化（.openpencil/pi-sessions/，gitignored）
 *    + index.json（sessionId → 文件路径）支持 dev server 重启后恢复
 *  - AgentSessionEvent → UIMessageChunk（mapping.ts）经 emit 直推 SSE
 *  - T20：customTools 注册（tools.ts，hello-tool create_shape 经 7600 桥执行），
 *    noTools: 'builtin' 禁内建保留自定义
 *  - T21：模型/凭据装配移交 provider-admin.ts（pi 原生 ModelRuntime +
 *    auth.json，无 key 可起服务）；prompt 可带 model 档位（前端 design role
 *    解析结果），缺省回退 openrouter/free 种子路由
 *  - T24：prompt 四层装配（T24-plan D1-D4）——AgentMode 注册表（modes.ts）
 *    建会话期烘焙 base prompt + 工具集；marketing 模式每 run 经 inline
 *    extension 的 before_agent_start 注入工作流段 + profile overlay
 *    （ephemeral、不落盘、run 后自清）；chatMode 请求级，切换即驱逐
 *    SessionEntry 重建（同 sessionId、JSONL 历史无损——JSONL 不存
 *    systemPrompt）
 *
 * 仅运行于独立后端进程（T20 起：main.ts 入口 / vite 插件 spawn 的子进程，
 * 不经 vite esbuild 打包）；只允许相对导入与 node/依赖包导入。
 * key 卫生：不读、不打印、不落盘任何 API key（凭据全部由 provider-admin
 * 经 pi ModelRuntime 管理）。
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type AgentSession,
  type InlineExtension
} from '@earendil-works/pi-coding-agent'
import type { UIMessage, UIMessageChunk } from 'ai'

import { loadBrandSeed, toBrandManifest, type PiBrandConfig } from './brand'
import type { PiBrandManifest } from './brand/manifest'
import type { PiChatMode } from './chat-mode'
import { readPiHistoryFile } from './history'
import { createPiEventMapper } from './mapping'
import { isPiChatMode, loadModeSegment, PI_CHAT_MODES } from './modes'
import { buildMarketingOverlay } from './prompt-overlay'
import type { ModelSpec, ProviderAdmin } from './provider-admin'
import type { PiSessionSummary } from './session-summary'
import { createOpenPencilTools } from './tools'

export type { PiSessionSummary }

/** T24：prompt 请求的可选装配参数（chatMode 缺省 ui；pickedProfileId 仅
 * marketing 模式生效——注册表 acceptsProfile 决定，ui 模式忽略） */
export type PiPromptOptions = {
  model?: ModelSpec
  documentId?: string
  chatMode?: PiChatMode
  pickedProfileId?: string | null
}

export type PiChatService = {
  prompt(
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void,
    options?: PiPromptOptions
  ): Promise<void>
  /** T22：会话族谱前缀 → 族内最新 sessionId（index.json 前缀扫描，无则 null） */
  resolveLatestSessionId(docKeyPrefix: string): string | null
  /** T22：读回指定会话历史（零副作用纯读，history.ts） */
  readHistory(sessionId: string): UIMessage[]
  /** T23：族内全部会话摘要，按创建后缀倒序（最新在前）；零副作用纯读 */
  listSessionFamily(docKeyPrefix: string): PiSessionSummary[]
  /** T24：brand manifest（种子脱敏投影，无 markdown 正文；种子缺失 → 空 manifest） */
  getBrandManifest(): PiBrandManifest
}

type SessionEntry = {
  session: AgentSession
  queue: Promise<void>
  /** T21 step budget：当前 prompt 已消耗的 turn 数（turn_start 事件递增） */
  budget: { current: number }
  /** T22 工具目标：当次请求的 documentId（桥 document_id 注入，T22-plan D4） */
  target: { documentId?: string }
  /** T24：建会话时烘焙的模式（base prompt + 工具集随其定型）；切换 = 驱逐重建 */
  mode: PiChatMode
  /** T24：当次请求的 profile 选择（per-run 注入，before_agent_start 闭包读取） */
  overlay: { pickedProfileId: string | null }
}

type SessionIndex = Record<string, { file: string }>

export function createPiChatService({
  rootDir,
  admin
}: {
  rootDir: string
  admin: ProviderAdmin
}): PiChatService {
  const stateDir = join(rootDir, '.openpencil')
  const agentDir = join(stateDir, 'pi-agent')
  const sessionsDir = join(stateDir, 'pi-sessions')
  const indexPath = join(sessionsDir, 'index.json')

  // T24 D6：brand 种子启动加载（缺失 → null 合法降级，overlay 走 fallback）
  const brand: PiBrandConfig | null = loadBrandSeed(rootDir)

  const sessions = new Map<string, SessionEntry>()

  function readIndex(): SessionIndex {
    try {
      return JSON.parse(readFileSync(indexPath, 'utf8')) as SessionIndex
    } catch {
      return {}
    }
  }

  function writeIndex(index: SessionIndex): void {
    mkdirSync(sessionsDir, { recursive: true })
    writeFileSync(indexPath, JSON.stringify(index, null, 2))
  }

  async function createSession(
    sessionId: string,
    modelSpec: ModelSpec | undefined,
    chatMode: PiChatMode
  ): Promise<SessionEntry> {
    const { modelRuntime, model } = await admin.resolveModel(modelSpec)
    mkdirSync(sessionsDir, { recursive: true })

    const indexedFile = readIndex()[sessionId]?.file
    const sessionManager =
      indexedFile && existsSync(indexedFile)
        ? SessionManager.open(indexedFile, sessionsDir)
        : SessionManager.create(rootDir, sessionsDir)

    // T21：step budget 每 session 一份（prompt 时清零、turn_start 递增），
    // 工具经闭包读它决定是否注 _warning（tools.ts）
    const budget = { current: 0 }
    // T22：documentId 以当次请求为准（session 复用、target 可变），
    // 工具经闭包读取注入桥 args.document_id
    const target: { documentId?: string } = {}
    const customTools = createOpenPencilTools({ current: () => budget.current }, target)

    // T24：模式注册表烘焙 base prompt；overlay 袋每 prompt 刷新，
    // before_agent_start 闭包读取（per-run 注入，不落盘）
    const mode = PI_CHAT_MODES[chatMode]
    const overlay: SessionEntry['overlay'] = { pickedProfileId: null }

    // T24 D3：四层装配的 per-run 层——工作流段（base 之后）+ profile overlay
    // （末位）。ui 模式注册表两项皆空 → 钩子不返回 → 基底 byte 级原样。
    // runner 链式语义：返回的 systemPrompt 仅当 run 生效，run 后回基底
    // （agent-session.js emitBeforeAgentStart / else 分支复位）。
    const assembly: InlineExtension = (pi) => {
      pi.on('before_agent_start', (event) => {
        let assembled = event.systemPrompt
        if (mode.workflowSegmentPath) {
          assembled += loadModeSegment(rootDir, mode.workflowSegmentPath)
        }
        if (mode.acceptsProfile) {
          assembled += buildMarketingOverlay({
            types: brand?.types ?? [],
            profiles: brand?.profiles ?? [],
            pickedProfileId: overlay.pickedProfileId
          })
        }
        return assembled === event.systemPrompt ? undefined : { systemPrompt: assembled }
      })
    }
    const extensionFactories: InlineExtension[] = [assembly]
    // 冒烟探针（免 key 装配验证）：登记在装配之后，event.systemPrompt 已是
    // 链式最终值；仅 PI_PROMPT_PROBE_DIR 显式设置时生效
    const probeDir = process.env.PI_PROMPT_PROBE_DIR
    if (probeDir) {
      extensionFactories.push((pi) => {
        pi.on('before_agent_start', (event) => {
          mkdirSync(probeDir, { recursive: true })
          writeFileSync(join(probeDir, 'last-system-prompt.md'), event.systemPrompt)
        })
      })
    }

    const { session } = await createAgentSession({
      cwd: rootDir,
      agentDir,
      model,
      modelRuntime,
      sessionManager,
      // T21：静态 system prompt 经 resourceLoader 烘焙（T24：按模式注册表选
      // base 段）+ 关闭 pi 侧上下文文件/skills/prompt 模板加载——否则 repo
      // 的 AGENTS.md 等会混入设计会话（旧 ToolLoop 只有静态 prompt，对齐）
      resourceLoader: await (async () => {
        const loader = new DefaultResourceLoader({
          cwd: rootDir,
          agentDir,
          systemPrompt: loadModeSegment(rootDir, mode.basePromptPath),
          noContextFiles: true,
          noSkills: true,
          noPromptTemplates: true,
          extensionFactories
        })
        // createAgentSession 只在自构 loader 时才 reload（sdk.js `if (!resourceLoader)`
        // 分支）——外部传入必须自己调，否则 extensionsResult 停留初始空集，
        // inline extension 永不登记（T24 冒烟实证：probe 不落盘、注入不发生）
        await loader.reload()
        return loader
      })(),
      // T20：'all' 会连 custom 工具一起禁；'builtin' 只禁内建（read/bash/edit/write）
      // 保留我们的设计工具（sdk.d.ts 语义实证，见 T20-self-check §2.1-1）
      noTools: 'builtin',
      customTools,
      ...(modelSpec?.thinkingLevel ? { thinkingLevel: modelSpec.thinkingLevel } : {})
    })

    const file = sessionManager.getSessionFile()
    if (file) {
      const index = readIndex()
      index[sessionId] = { file }
      writeIndex(index)
    }

    const entry: SessionEntry = {
      session,
      queue: Promise.resolve(),
      budget,
      target,
      mode: chatMode,
      overlay
    }
    sessions.set(sessionId, entry)
    return entry
  }

  async function prompt(
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void,
    options: PiPromptOptions = {}
  ): Promise<void> {
    const chatMode: PiChatMode = isPiChatMode(options.chatMode) ? options.chatMode : 'ui'
    // T24 D4：模式切换 = 驱逐缓存 SessionEntry，createSession 经
    // SessionManager.open 重建（同 sessionId、JSONL 历史无损；新对象携带
    // 新模式的 base prompt 与工具集）。不开新 sessionId、不 fork。
    const existing = sessions.get(sessionId)
    if (existing && existing.mode !== chatMode) {
      // 进行中的 run 收尾再驱逐（正常路径不会发生——前端流式中禁发，
      // 这里是防御性排队，防 dispose 腰斩活跃流）
      await existing.queue.catch(() => undefined)
      existing.session.dispose()
      sessions.delete(sessionId)
    }
    const entry =
      sessions.get(sessionId) ?? (await createSession(sessionId, options.model, chatMode))
    entry.target.documentId = options.documentId
    entry.overlay.pickedProfileId = PI_CHAT_MODES[chatMode].acceptsProfile
      ? (options.pickedProfileId ?? null)
      : null
    // 同一 session 的 prompt 串行：pi 在 streaming 中再 prompt 需要 streamingBehavior，
    // dev 单用户场景直接排队即可
    entry.queue = entry.queue.then(() => runPrompt(entry, sessionId, text, emit))
    await entry.queue
  }

  async function runPrompt(
    entry: SessionEntry,
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void
  ): Promise<void> {
    const mapper = createPiEventMapper(`pi-${randomUUID()}`)
    const debug = process.env.PI_BACKEND_DEBUG === '1'
    entry.budget.current = 0
    const unsubscribe = entry.session.subscribe((event) => {
      if (event.type === 'turn_start') entry.budget.current++
      if (debug) {
        const sub = event.type === 'message_update' ? `/${event.assistantMessageEvent.type}` : ''
        console.error(`[pi-backend:event] ${event.type}${sub}`)
      }
      for (const chunk of mapper(event)) emit(chunk)
    })
    try {
      await entry.session.prompt(text)
    } catch (error) {
      emit({ type: 'error', errorText: error instanceof Error ? error.message : String(error) })
      emit({ type: 'finish', finishReason: 'error' })
    } finally {
      unsubscribe()
      // prompt 完成后 session 文件必然已落盘，补记 index（create 时 file 可能尚未生成）
      const file = entry.session.sessionManager.getSessionFile()
      if (file && readIndex()[sessionId]?.file !== file) {
        const index = readIndex()
        index[sessionId] = { file }
        writeIndex(index)
      }
    }
  }

  function resolveLatestSessionId(docKeyPrefix: string): string | null {
    // T22 D2/D3：族内会话 = index 键以 `<前缀>-` 起头；时间戳后缀定长字典序
    // 可排（yyyyMMddTHHmmssZ），sort 末位即最新
    const prefix = `${docKeyPrefix}-`
    const keys = Object.keys(readIndex())
      .filter((key) => key.startsWith(prefix))
      .sort()
    return keys.at(-1) ?? null
  }

  function readHistory(sessionId: string): UIMessage[] {
    const file = readIndex()[sessionId]?.file
    if (!file || !existsSync(file)) return []
    return readPiHistoryFile(file)
  }

  function summarizeSession(sessionId: string, file: string | undefined): PiSessionSummary {
    if (!file || !existsSync(file)) {
      return { sessionId, title: '', messageCount: 0, updatedAtMs: 0 }
    }
    const messages = readPiHistoryFile(file)
    const firstUserText = messages
      .find((message) => message.role === 'user')
      ?.parts.find((part) => part.type === 'text')
    return {
      sessionId,
      title: firstUserText?.text.slice(0, 40) ?? '',
      messageCount: messages.length,
      updatedAtMs: statSync(file).mtimeMs
    }
  }

  function listSessionFamily(docKeyPrefix: string): PiSessionSummary[] {
    // T23 E1：族 = index 键前缀扫描（同 resolveLatestSessionId），倒序 = 最新在前；
    // 逐文件纯读派生摘要，不写 index 不开会话（T22 recon 15 读取陷阱沿用）
    const prefix = `${docKeyPrefix}-`
    const index = readIndex()
    return Object.keys(index)
      .filter((key) => key.startsWith(prefix))
      .sort()
      .reverse()
      .map((sessionId) => summarizeSession(sessionId, index[sessionId]?.file))
  }

  function getBrandManifest(): PiBrandManifest {
    return toBrandManifest(brand)
  }

  return { prompt, resolveLatestSessionId, readHistory, listSessionFamily, getBrandManifest }
}
