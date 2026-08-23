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
 *
 * 仅运行于独立后端进程（T20 起：main.ts 入口 / vite 插件 spawn 的子进程，
 * 不经 vite esbuild 打包）；只允许相对导入与 node/依赖包导入。
 * key 卫生：不读、不打印、不落盘任何 API key（凭据全部由 provider-admin
 * 经 pi ModelRuntime 管理）。
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type AgentSession
} from '@earendil-works/pi-coding-agent'
import type { UIMessageChunk } from 'ai'

import { createPiEventMapper } from './mapping'
import type { ModelSpec, ProviderAdmin } from './provider-admin'
import { createOpenPencilTools } from './tools'

export type PiChatService = {
  prompt(
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void,
    model?: ModelSpec
  ): Promise<void>
}

type SessionEntry = {
  session: AgentSession
  queue: Promise<void>
  /** T21 step budget：当前 prompt 已消耗的 turn 数（turn_start 事件递增） */
  budget: { current: number }
}

type SessionIndex = Record<string, { file: string }>

let cachedSystemPrompt: string | null = null

/** 旧 ToolLoop 同款静态 system prompt（src/app/ai/chat/system-prompt.md），后端读盘 */
function loadSystemPrompt(rootDir: string): string {
  cachedSystemPrompt ??= readFileSync(join(rootDir, 'src/app/ai/chat/system-prompt.md'), 'utf8')
  return cachedSystemPrompt
}

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

  async function createSession(sessionId: string, modelSpec?: ModelSpec): Promise<SessionEntry> {
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
    const customTools = createOpenPencilTools({ current: () => budget.current })

    const { session } = await createAgentSession({
      cwd: rootDir,
      agentDir,
      model,
      modelRuntime,
      sessionManager,
      // T21：静态 system prompt（旧 ToolLoop 同款 system-prompt.md，后端读盘，
      // 单一事实源）+ 关闭 pi 侧上下文文件/skills/prompt 模板加载——否则 repo
      // 的 AGENTS.md 等会混入设计会话（旧 ToolLoop 只有静态 prompt，对齐）
      resourceLoader: new DefaultResourceLoader({
        cwd: rootDir,
        agentDir,
        systemPrompt: loadSystemPrompt(rootDir),
        noContextFiles: true,
        noSkills: true,
        noPromptTemplates: true
      }),
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

    const entry: SessionEntry = { session, queue: Promise.resolve(), budget }
    sessions.set(sessionId, entry)
    return entry
  }

  async function prompt(
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void,
    model?: ModelSpec
  ): Promise<void> {
    const entry = sessions.get(sessionId) ?? (await createSession(sessionId, model))
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

  return { prompt }
}
