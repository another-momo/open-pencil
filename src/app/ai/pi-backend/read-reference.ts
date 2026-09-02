/**
 * T85（资产 references 按需读取机制，定谳 4）：read_reference 后端本地工具工厂——全新建。
 *
 * 语义：三类 studio 资产 frontmatter 声明 `references: [{path, description}]`（声明即
 * 白名单），assembleTurn 把本回合 active 资产的并集索引进 systemPrompt 尾段（「按需
 * 参考」节，active-design-host.ts）；本工具是唯一读取缝——`noTools: 'builtin'` 禁
 * pi 内建 read 不变。允许集 = 本回合 active 资产声明的 references 并集（宿主持有于
 * turn 缓存袋，finalizeTurn 随 turn=null 复位——同 intentConfirmed 一次性态纪律）。
 *
 * 命中 → 读文件返回全文（50KB 上限，超出按字节截断 + 尾部注明）；未命中/未声明 →
 * 结构化错误并列出本回合可读 path 清单；`..` / 绝对路径在 validate（声明期）与本工具
 * （运行期）双侧拒（纵深防御——白名单键本身是归一化相对路径，遍历串天然不命中，
 * 本侧显式拒止给出清晰错误而非误导性的「未声明」）。
 *
 * 装配形态：createReadReferenceTool(deps) 工厂返回 pi AgentTool——service.ts 装配进
 * customTools（createAskUserQuestionTool 同缝）。无桥调用、无凭证、无落盘——纯本地
 * 文件读取 + 白名单判定。
 */

import { readFileSync } from 'node:fs'

import { defineTool, type AgentToolResult } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

/** 单次读取体积上限（超出按字节截断 + 尾部注明） */
export const READ_REFERENCE_MAX_BYTES = 50 * 1024

const READ_REFERENCE_DESCRIPTION =
  'Read one on-demand reference file declared by the active studio assets (base/workflow/profile). The readable paths for THIS turn are listed in the system prompt section "按需参考（read_reference 工具按需读取）" — pass `path` exactly as listed there (relative, .md only). Reads are whitelisted per turn: any other path is rejected and the error echoes the readable list. Returns the file text (truncated past 50KB with a trailing note). Use it to pull detailed design guidance only when the current step actually needs it — do not pre-read everything.'

export interface ReadReferenceToolDeps {
  /** 本回合允许集（声明 path → 加载期解析绝对路径）；宿主每回合装配、finalizeTurn 复位 */
  allowedPaths(): ReadonlyMap<string, string>
  /** 文件读取（缺省 node:fs 同步读 utf8，同 registry 加载口径）；测试注入确定性 */
  readFile?: (absolutePath: string) => string
}

/** 运行期遍历/绝对路径拒止（null = 通过）；validate 侧拒声明期，本侧拒运行期（纵深防御） */
function rejectedPathReason(path: string): string | null {
  if (path.startsWith('/')) return '是绝对路径'
  if (/^[A-Za-z]:/.test(path)) return '含盘符'
  if (path.split('/').some((seg) => seg === '..')) return '含 `..` 上跳'
  return null
}

function toToolResult(result: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    details: result
  }
}

export function createReadReferenceTool(deps: ReadReferenceToolDeps) {
  const readFile = deps.readFile ?? ((absolutePath: string) => readFileSync(absolutePath, 'utf8'))
  return defineTool({
    name: 'read_reference',
    label: 'Read Reference',
    description: READ_REFERENCE_DESCRIPTION,
    parameters: Type.Object({
      path: Type.String({
        description: 'Reference path exactly as listed in the 按需参考 section (relative, .md)'
      })
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> {
      const requested = typeof params.path === 'string' ? params.path.trim() : ''
      // 请求侧同口径归一（validate 存储形态 = 正斜杠相对路径）
      const normalized = requested.replaceAll('\\', '/')
      const allowed = deps.allowedPaths()
      const available = [...allowed.keys()]

      const rejected = requested === '' ? 'path 为空' : rejectedPathReason(normalized)
      if (rejected) {
        return toToolResult({
          error: 'reference_path_rejected',
          message: `path「${requested}」${rejected}——只接受本回合「按需参考」节列出的相对 .md 路径`,
          available
        })
      }

      const abs = allowed.get(normalized)
      if (!abs) {
        return toToolResult({
          error: 'reference_not_allowed',
          message:
            available.length === 0
              ? `path「${normalized}」不在本回合可读清单——本回合 active 资产未声明任何 references（无可读项）`
              : `path「${normalized}」不在本回合可读清单——仅可读：${available.join('、')}`,
          available
        })
      }

      let text: string
      try {
        text = readFile(abs)
      } catch (e) {
        return toToolResult({
          error: 'reference_read_failed',
          message: `读取失败：${e instanceof Error ? e.message : String(e)}——文件在加载期存在性已检，运行期缺失通常是加载后被移动/删除；重载 studio 注册表后再试`,
          available
        })
      }

      const bytes = Buffer.byteLength(text, 'utf8')
      let truncated = false
      if (bytes > READ_REFERENCE_MAX_BYTES) {
        truncated = true
        // 字节截断可能切开多字节字符——剥掉边界替代符（U+FFFD），保持输出为干净 utf8
        text = Buffer.from(text, 'utf8')
          .subarray(0, READ_REFERENCE_MAX_BYTES)
          .toString('utf8')
          .replace(/�+$/, '')
        text += `\n\n[已截断：原文约 ${Math.round(bytes / 1024)}KB，超出 ${READ_REFERENCE_MAX_BYTES / 1024}KB 上限——以上为前 50KB]`
      }
      return {
        content: [{ type: 'text', text }],
        details: { path: normalized, bytes, truncated }
      }
    }
  })
}
