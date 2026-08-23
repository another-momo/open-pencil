/**
 * T19 pi 后端 service：pi SDK 库形态薄封装（D21：不经 harness，直用
 * @earendil-works/pi-coding-agent 库 API）。
 *
 * 职责：
 *  - ModelRuntime + openrouter/free 装配（形状照抄 spikes/s-pi/live-chat.mjs，T18 实测）
 *  - tab 级 session 池：sessionId → AgentSession，提示按 session 串行
 *  - SessionManager JSONL 持久化（.openpencil/pi-sessions/，gitignored）
 *    + index.json（sessionId → 文件路径）支持 dev server 重启后恢复
 *  - AgentSessionEvent → UIMessageChunk（mapping.ts）经 emit 直推 SSE
 *
 * 仅运行于 Node（vite dev server 中间件）；只允许相对导入与 node/依赖包导入。
 * key 卫生：OPENROUTER_API_KEY 只经 process.env 读取（models.json 里为
 * "$OPENROUTER_API_KEY" 引用），不打印、不落盘明文。
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession
} from '@earendil-works/pi-coding-agent'
import type { UIMessageChunk } from 'ai'

import { createPiEventMapper } from './mapping'

export type PiChatService = {
  prompt(sessionId: string, text: string, emit: (chunk: UIMessageChunk) => void): Promise<void>
}

type SessionEntry = {
  session: AgentSession
  queue: Promise<void>
}

type SessionIndex = Record<string, { file: string }>

const OPENROUTER_FREE_MODELS = {
  providers: {
    openrouter: {
      apiKey: '$OPENROUTER_API_KEY',
      models: [
        {
          id: 'openrouter/free',
          name: 'OpenRouter Free (meta route)',
          api: 'openai-completions',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 65536,
          maxTokens: 8192
        }
      ]
    }
  }
} as const

export function createPiChatService({ rootDir }: { rootDir: string }): PiChatService {
  const stateDir = join(rootDir, '.openpencil')
  const agentDir = join(stateDir, 'pi-agent')
  const sessionsDir = join(stateDir, 'pi-sessions')
  const indexPath = join(sessionsDir, 'index.json')

  const sessions = new Map<string, SessionEntry>()
  let runtimePromise: Promise<{
    modelRuntime: ModelRuntime
    model: NonNullable<ReturnType<ModelRuntime['getModel']>>
  }> | null = null

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

  function ensureRuntime() {
    runtimePromise ??= (async () => {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY 未注入 vite dev server 进程（pi 后端无 key 不起服务）')
      }
      mkdirSync(agentDir, { recursive: true })
      mkdirSync(sessionsDir, { recursive: true })
      writeFileSync(join(agentDir, 'models.json'), JSON.stringify(OPENROUTER_FREE_MODELS))
      const modelRuntime = await ModelRuntime.create({
        authPath: join(agentDir, 'auth.json'),
        modelsPath: join(agentDir, 'models.json')
      })
      const model = modelRuntime.getModel('openrouter', 'openrouter/free')
      if (!model) throw new Error('openrouter/free 模型装配失败（models.json 覆盖未命中）')
      return { modelRuntime, model }
    })()
    return runtimePromise
  }

  async function createSession(sessionId: string): Promise<SessionEntry> {
    const { modelRuntime, model } = await ensureRuntime()

    const indexedFile = readIndex()[sessionId]?.file
    const sessionManager =
      indexedFile && existsSync(indexedFile)
        ? SessionManager.open(indexedFile, sessionsDir)
        : SessionManager.create(rootDir, sessionsDir)

    const { session } = await createAgentSession({
      cwd: rootDir,
      agentDir,
      model,
      modelRuntime,
      sessionManager,
      noTools: 'all'
    })

    const file = sessionManager.getSessionFile()
    if (file) {
      const index = readIndex()
      index[sessionId] = { file }
      writeIndex(index)
    }

    const entry: SessionEntry = { session, queue: Promise.resolve() }
    sessions.set(sessionId, entry)
    return entry
  }

  async function prompt(
    sessionId: string,
    text: string,
    emit: (chunk: UIMessageChunk) => void
  ): Promise<void> {
    const entry = sessions.get(sessionId) ?? (await createSession(sessionId))
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
    const unsubscribe = entry.session.subscribe((event) => {
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
