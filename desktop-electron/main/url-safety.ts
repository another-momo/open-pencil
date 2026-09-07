/**
 * Copyright 2026 Craft Docs Ltd.
 *
 * 改编自 craft-agents-oss 项目：packages/shared/src/utils/url-safety.ts
 * （Apache-2.0，原作者 Craft Docs Ltd.）
 *
 * 改动点（仅适配 Electron main 进程侧的「窗内打开 vs 系统外链打开」
 * 决策面，不改分类算法）：
 *   1. 删除 INTERNAL_DEEPLINK_SCHEME（craftagents:）——本项目无此 scheme，
 *      内部分类多余；如需后续添加可在此文件恢复。
 *   2. 增加 isLoopbackHttpUrl：will-navigate 拦截仅放行 http://127.0.0.1
 *      /http://localhost 的回环 URL，避免误伤 Electron 加载自身回环服务
 *      的初始 loadURL 与 SPA 内同源跳转。
 *   3. 增加 isHttpOrHttps：shell.openExternal 兜底白名单——只有 http/https
 *      落到系统浏览器，其它 schemes 直接 deny（与 classifyExternalUrl 的
 *      dangerous 判定保持一致）。
 *   4. UrlClassification 仅保留 dangerous 与 safe-external 两态——本项目
 *      没有 internal-deeplink 概念。
 *
 * Apache-2.0 许可全文与 NOTICE 见参考项目仓根（参考项目/craft-agents-oss/
 * LICENSE 与 NOTICE）；本仓 LICENSE 为上游 OpenPencil 自有许可，与本文件
 * 的 Apache-2.0 归属并存。本文件保留归属头以便审计追溯。
 */

export type UrlClassification =
  | { kind: 'dangerous'; scheme?: string; reason: string }
  | { kind: 'safe-external' }

/**
 * 黑名单 schemes（带尾冒号）。reason 是给 blocked 时的用户可读原因——本项
 * 决定不在 Electron 上做 toast（仅日志），reason 仍保留供上游 UI 想做时
 * 直接消费。
 */
const DANGEROUS_SCHEMES: ReadonlyMap<string, string> = new Map([
  ['javascript:', 'JavaScript URLs can execute arbitrary code in the renderer (XSS vector).'],
  ['data:', 'data: URLs can embed executable content and bypass scheme restrictions.'],
  ['vbscript:', 'VBScript URLs are a legacy script-execution vector.'],
  ['blob:', 'blob: URLs are renderer-scoped and do not resolve outside this window.'],
  [
    'file:',
    'file: URLs are blocked because shell.openExternal can launch local executables on Windows (Electron RCE class). Open the file from your OS file manager instead.',
  ],
])

export function classifyExternalUrl(rawUrl: string): UrlClassification {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { kind: 'dangerous', reason: 'URL is empty or whitespace-only.' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { kind: 'dangerous', reason: 'URL is malformed and cannot be parsed.' }
  }

  const protocol = parsed.protocol.toLowerCase()

  const blockedReason = DANGEROUS_SCHEMES.get(protocol)
  if (blockedReason) {
    return { kind: 'dangerous', scheme: protocol, reason: blockedReason }
  }

  return { kind: 'safe-external' }
}

export function isSafeExternalUrl(rawUrl: string): boolean {
  return classifyExternalUrl(rawUrl).kind === 'safe-external'
}

/**
 * 窗内导航白名单：仅放行回环 http——本项目页面是经
 * http://127.0.0.1:<random port> 进入，dev 形态下也走 127.0.0.1 域下的
 * vite dev server。其它任何 host（包括 0.0.0.0 改写 / IPv6 / 公网 host）
 * 都必须经 will-navigate 拦截并改走 shell.openExternal，避免模型输出或
 * 第三方资源意外触发页内跳走。
 */
export function isLoopbackHttpUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:') return false
  const host = parsed.hostname.toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
}

/**
 * shell.openExternal 兜底白名单——只有 http/https 落到系统浏览器；其它
 * schemes 即便 classifyExternalUrl 返回 safe-external，也由调用方在
 * setWindowOpenHandler 二次过滤。
 */
export function isHttpOrHttps(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  const protocol = parsed.protocol.toLowerCase()
  return protocol === 'http:' || protocol === 'https:'
}