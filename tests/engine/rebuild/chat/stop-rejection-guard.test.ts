/**
 * T98：停止按钮 unhandledrejection 守卫的收窄语义钉扎。
 *
 * 背景：ai SDK AbstractChat.stop() 的 abort() 会同步触发 SDK 内部一个无人
 * await 的流泵 promise 以 AbortError reject（Chrome 报文 'BodyStreamBuffer
 * was aborted'）——该 rejection 不是 stop() 自身的 promise，调用点
 * await + try/catch 捕不到（浏览器实证），唯一收口面是
 * unhandledrejection + preventDefault。守卫必须三重收窄不误伤：
 *  ① 仅 markIntentionalStop() 立的 2s 窗口期内；
 *  ② 仅 abort 形状错误（isAbortShapedError）；
 *  ③ 栈归因须含 'AbstractChat.stop'。
 * 任一不满足 → 不 preventDefault，rejection 照常进 console。
 *
 * 测试栈纪律：不引入 happy-dom——守卫只调 window.addEventListener，用
 * globalThis.window 桩捕获监听器即可驱动全部分支。
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'

import { installStopRejectionGuard, markIntentionalStop } from '@/app/ai/fork/transports'

type RejectionEvent = {
  reason: unknown
  defaultPrevented: boolean
  preventDefault: () => void
}

function abortFromStopStack(): Error {
  const err = new Error('BodyStreamBuffer was aborted')
  err.name = 'AbortError'
  err.stack =
    'AbortError: BodyStreamBuffer was aborted\n' +
    '    at AbstractChat.stop (http://localhost:1420/node_modules/.vite/deps/dist.js:23664:61)\n' +
    '    at handleStop (http://localhost:1420/src/components/assistant/ChatPanel.vue:269:23)'
  return err
}

describe('T98 stop rejection guard（三重收窄）', () => {
  let listener: ((event: RejectionEvent) => void) | null = null

  beforeAll(() => {
    const fakeWindow = {
      addEventListener(type: string, cb: (event: RejectionEvent) => void) {
        if (type === 'unhandledrejection') listener = cb
      }
    }
    ;(globalThis as { window?: unknown }).window = fakeWindow
    installStopRejectionGuard()
  })

  afterAll(() => {
    delete (globalThis as { window?: unknown }).window
  })

  function fire(reason: unknown): RejectionEvent {
    const event: RejectionEvent = {
      reason,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true
      }
    }
    listener?.(event)
    return event
  }

  test('守卫已安装并捕获到 unhandledrejection 监听器', () => {
    expect(listener).not.toBeNull()
  })

  test('收窄①：未立窗口期旗标——形状全中也不吞（自然断流照常报错）', () => {
    // 此时模块内 intentionalStopUntil 仍为 0，任何 rejection 都早退
    const event = fire(abortFromStopStack())
    expect(event.defaultPrevented).toBe(false)
  })

  test('收窄全中：窗口期内 + abort 形状 + AbstractChat.stop 栈归因 → 吞', () => {
    markIntentionalStop()
    const event = fire(abortFromStopStack())
    expect(event.defaultPrevented).toBe(true)
  })

  test('收窄③：窗口期内但栈不归因 AbstractChat.stop → 不吞', () => {
    markIntentionalStop()
    const err = new Error('BodyStreamBuffer was aborted')
    err.name = 'AbortError'
    err.stack = 'AbortError: BodyStreamBuffer was aborted\n    at fetchSomething (app.ts:1:1)'
    expect(fire(err).defaultPrevented).toBe(false)
  })

  test('收窄②：窗口期内但非 abort 形状 → 不吞', () => {
    markIntentionalStop()
    const err = new TypeError('Cannot read properties of null')
    err.stack = 'TypeError: ...\n    at AbstractChat.stop (dist.js:23664:61)'
    expect(fire(err).defaultPrevented).toBe(false)
  })

  test('收窄①：窗口期（2s）过期后不再吞', () => {
    markIntentionalStop()
    const nowSpy = spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000)
    try {
      expect(fire(abortFromStopStack()).defaultPrevented).toBe(false)
    } finally {
      nowSpy.mockRestore()
    }
  })
})
