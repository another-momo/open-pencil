/**
 * 桥 URL 运行时通道——把 build-time 烘焙的 __OPENPENCIL_LOCAL_AUTOMATION_URL__
 * 与运行时全局 window.__OPENPENCIL_RUNTIME_BRIDGE_URL__ 统一在一处解析。
 *
 * 优先级链（与 token 同款 runtime.ts P104 模式）：
 *   1. window.__OPENPENCIL_RUNTIME_BRIDGE_URL__（宿主注入，字符串）
 *   2. __OPENPENCIL_LOCAL_AUTOMATION_URL__（vite define 烘焙，dev / 静态托管）
 *   3. `ws://127.0.0.1:${AUTOMATION_HTTP_PORT}`（fallback）
 *
 * dev 形态：宿主不注入运行时全局 → 走烘焙值 → 行为与本文件创建前逐字节相同。
 * Electron 形态：electron main 注入运行时全局 → 走随机端口的桥，规避 7600。
 *
 * ws/http 互相改写：宿主只需注入 ws://…，health 探活派生 http。
 * DEV_AUTOMATION_HTTP_URL 仍走 runtime.ts 自身的 http fallback 推导（替换 ws→
 * http），二者共用同一来源 runtime URL 或烘焙值，URL 主体一致。
 */
import { IS_BROWSER } from '@open-pencil/core/constants'

declare global {
  interface Window {
    __OPENPENCIL_RUNTIME_BRIDGE_URL__?: unknown
  }
}

function readRuntimeBridgeURL(): string | null {
  if (!IS_BROWSER) return null
  const value = window.__OPENPENCIL_RUNTIME_BRIDGE_URL__
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** WS URL——给 client.ts connectAutomation 消费 */
export function resolveAutomationWSURL(): string {
  // 运行时全局优先于烘焙值；无任何来源时回退到默认端口。
  // dev 形态：宿主不注入 → 命中烘焙值，与 build-time 行为逐字节相同。
  return readRuntimeBridgeURL() ?? __OPENPENCIL_LOCAL_AUTOMATION_URL__
}

/** HTTP URL——给 runtime.ts readAutomationHealth 消费（健康探活） */
export function resolveAutomationHTTPURL(): string {
  return resolveAutomationWSURL().replace(/^ws/, 'http')
}
