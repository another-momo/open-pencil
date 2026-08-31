/**
 * T24 四层装配冒烟（T24-plan §2 C4/C5 的浏览器半）。
 *
 * 不需要 LLM key：
 *  - /api/pi-chat 用 playwright route 拦截——捕获请求体（chatMode/pickedProfileId
 *    断言，C4 载荷最小）并回灌固定 SSE 流，不经真实 LLM
 *  - manifest 走真实后端（GET /api/pi/studio/manifest，T45 改源 studio 文件
 *    注册表）——profile 下拉内容即注册表投影
 *
 * T45 连带：种子 config.yaml 退役——休闲活泼（casual_v1）未迁入 studio 集，
 * 本冒烟的选中项改为水彩海报 v3（watercolor_poster_v3）。
 *
 * 实证流程要点沿用 t23 sessions-bind-smoke 头注释（恢复对话框/AI tab 复位/
 * openFile vite 路径/clear 异步等），勿回退。
 *
 * 覆盖：
 *  ① 默认 ui 模式：模式选择器显示 "UI design"、profile 下拉不渲染；
 *    发送体 chatMode='ui' + pickedProfileId=null（C4/C5 默认态）
 *  ② 切 marketing：profile 下拉出现；打开列出注册表 profiles（水彩海报 v3
 *    等四精品——T48 补迁 watercolor_poster_v2）与 "No style profile" 项（C5 manifest 投影真实可见）
 *  ③ 选 watercolor_poster_v3 后发送：请求体 chatMode='marketing' +
 *    pickedProfileId='watercolor_poster_v3'，且体不含任何 manifest/overlay
 *    内容（C4 最小载荷）；SSE 延迟期间两个选择器均禁用（C5 流式中禁用）
 *  ④ 刷新恢复后选择态保留（Marketing + 水彩海报 v3，localStorage 持久化，C5）
 *  ⑤ 切回 ui：profile 下拉消失；发送体 chatMode='ui'（注册表 acceptsProfile
 *    语义由后端兜底忽略 profile，浏览器只断言模式字段）
 *  ⑥ 第二页面拦死 manifest 路由（abort）：profile 下拉禁用空态降级、
 *    触发器文案回占位（C5 失败路径；后端 overlay 同步走 fallback 由
 *    prompt-assembly-smoke 的无种子后端半覆盖）
 *
 * 前置：dev server 已起（T25 D3 后门退役）+ pi 后端已起（manifest 路由）。
 * 运行：node spikes/s-pi/backend-smoke/t24/mode-overlay-bind-smoke.mjs [base=http://localhost:1420]
 *   ⚠ 必须用 node——bun 跑 playwright chromium.launch 会卡 CDP pipe 握手
 *   （2026-08-24 实证：bun 下 180s launch timeout，node 秒起；二进制本身正常）
 */

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { chromium, selectors } from '@playwright/test'

// 仓内测试属性是 data-test-id（playwright 默认 data-testid 不匹配，脚本无配置文件）
selectors.setTestIdAttribute('data-test-id')

const base = process.argv[2] ?? 'http://localhost:1420'

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

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  }
  const pinned = chromium.executablePath()
  if (existsSync(pinned)) return undefined
  const cache = join(homedir(), 'AppData', 'Local', 'ms-playwright')
  const candidates = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
  for (const dir of candidates) {
    const exe = join(cache, dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
    if (existsSync(exe)) return exe
  }
  return undefined
}

const chatRequests = []
let delayNextFulfillMs = 0

const browser = await chromium.launch({
  executablePath: resolveChromiumExecutable(),
  args: ['--enable-unsafe-swiftshader']
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (err) => console.error(`[pageerror] ${String(err).slice(0, 200)}`))

await page.route('**/api/pi-chat', async (route) => {
  const body = route.request().postData() ?? '{}'
  try {
    chatRequests.push(JSON.parse(body))
  } catch {
    chatRequests.push({ sessionId: null })
  }
  if (delayNextFulfillMs > 0) {
    await new Promise((r) => setTimeout(r, delayNextFulfillMs))
    delayNextFulfillMs = 0
  }
  const sse = [
    'data: {"type":"start","messageId":"t24smoke"}',
    '',
    'data: {"type":"text-start","id":"t24t1"}',
    '',
    'data: {"type":"text-delta","id":"t24t1","delta":"T24-ECHO"}',
    '',
    'data: {"type":"text-end","id":"t24t1"}',
    '',
    'data: {"type":"finish","finishReason":"stop"}',
    '',
    'data: [DONE]',
    ''
  ].join('\n')
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1'
    },
    body: sse
  })
})

async function activateAiTab() {
  await page.getByTestId('properties-tab-ai').click()
  await page.getByRole('textbox', { name: 'Describe a change' }).waitFor({ timeout: 10000 })
}

async function sendChat(text) {
  const before = chatRequests.length
  const input = page.getByRole('textbox', { name: 'Describe a change' })
  await input.click()
  await input.pressSequentially(text, { delay: 5 })
  await page.getByRole('button', { name: '发送消息' }).click()
  for (let i = 0; i < 60 && chatRequests.length === before; i++) {
    await new Promise((r) => setTimeout(r, 250))
  }
  return chatRequests.at(-1)
}

async function waitEcho() {
  await page
    .getByTestId('chat-messages')
    .filter({ hasText: 'T24-ECHO' })
    .first()
    .waitFor({ timeout: 15000 })
}

function modeSelectLabel() {
  return page.evaluate(
    () => document.querySelector('[data-test-id="chat-mode-select"]')?.textContent?.trim() ?? null
  )
}

function profileSelectPresent() {
  return page.evaluate(
    () => document.querySelector('[data-test-id="chat-style-profile-select"]') !== null
  )
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: '设计' }).waitFor({ timeout: 20000 })
  await activateAiTab()

  // ── ① 默认 ui 模式
  check('① 模式选择器可见且默认 UI design', (await modeSelectLabel()) === 'UI design')
  check('① ui 模式不渲染 profile 下拉', !(await profileSelectPresent()))
  const first = await sendChat('t24 first ui message')
  await waitEcho()
  check(
    '① 发送体默认载荷：chatMode=ui + pickedProfileId=null',
    first?.chatMode === 'ui' && first?.pickedProfileId === null,
    JSON.stringify({ chatMode: first?.chatMode, pickedProfileId: first?.pickedProfileId })
  )

  // ── ② 切 marketing：profile 下拉出现且列出注册表 profiles
  await page.getByTestId('chat-mode-select').click()
  await page.getByRole('option', { name: 'Marketing' }).click()
  check('② 切 marketing 后模式标签更新', (await modeSelectLabel()) === 'Marketing')
  await page.getByTestId('chat-style-profile-select').waitFor({ timeout: 10000 })
  check('② marketing 模式渲染 profile 下拉', await profileSelectPresent())
  await page.getByTestId('chat-style-profile-select').click()
  const editorialOption = page.getByRole('option', { name: '杂志封面海报' })
  const watercolorOption = page.getByRole('option', { name: '水彩海报 v3' })
  const watercolorV2Option = page.getByRole('option', { name: '水彩海报 v2' })
  const solidOption = page.getByRole('option', { name: '扁平几何海报' })
  await watercolorOption.waitFor({ timeout: 10000 })
  check(
    '② profile 下拉列出注册表四精品（杂志封面海报 / 水彩海报 v2 / 水彩海报 v3 / 扁平几何海报，T48）',
    (await editorialOption.count()) === 1 &&
      (await watercolorV2Option.count()) === 1 &&
      (await watercolorOption.count()) === 1 &&
      (await solidOption.count()) === 1
  )
  check(
    '② profile 下拉含 "No style profile" 清除项',
    (await page.getByRole('option', { name: 'No style profile' }).count()) === 1
  )

  // ── ③ 选 watercolor_poster_v3 → 延迟 SSE 发送：载荷断言 + 流式中禁用
  await watercolorOption.click()
  check(
    '③ 选中后触发器标签 = 水彩海报 v3',
    await page.evaluate(
      () =>
        document
          .querySelector('[data-test-id="chat-style-profile-select"]')
          ?.textContent?.includes('水彩海报 v3') ?? false
    )
  )
  delayNextFulfillMs = 1500
  const marketingSend = await sendChat('t24 marketing picked message')
  // SSE 延迟窗口内选择器应禁用（流式中禁切模式/换 profile）
  const disabledMidStream = await page.evaluate(() => {
    const mode = document.querySelector('[data-test-id="chat-mode-select"]')
    const profile = document.querySelector('[data-test-id="chat-style-profile-select"]')
    return {
      mode: mode?.hasAttribute('disabled') || mode?.getAttribute('aria-disabled') === 'true',
      profile:
        profile?.hasAttribute('disabled') || profile?.getAttribute('aria-disabled') === 'true'
    }
  })
  check(
    '③ 流式中两个选择器均禁用',
    disabledMidStream.mode && disabledMidStream.profile,
    JSON.stringify(disabledMidStream)
  )
  await waitEcho()
  check(
    '③ 发送体：chatMode=marketing + pickedProfileId=watercolor_poster_v3',
    marketingSend?.chatMode === 'marketing' &&
      marketingSend?.pickedProfileId === 'watercolor_poster_v3',
    JSON.stringify({
      chatMode: marketingSend?.chatMode,
      pickedProfileId: marketingSend?.pickedProfileId
    })
  )
  const rawBody = JSON.stringify(marketingSend ?? {})
  check(
    '③ 载荷最小：体不含 manifest/overlay 内容（无 profile 正文、无 types 段标题）',
    !rawBody.includes('水彩海报') &&
      !rawBody.includes('Material types in the current brand') &&
      !rawBody.includes('applicableTo'),
    rawBody.slice(0, 200)
  )

  // ── ④ 刷新恢复后选择态持久化
  await page.evaluate(() => window.openPencil?.getStore?.()?.persistRecoveryNow?.())
  await page.reload({ waitUntil: 'domcontentloaded' })
  const restoreBtn = page.getByRole('button', { name: '恢复', exact: true })
  await restoreBtn.waitFor({ state: 'visible', timeout: 20000 })
  await restoreBtn.click()
  await activateAiTab()
  check('④ 刷新后模式选择保留 Marketing', (await modeSelectLabel()) === 'Marketing')
  check(
    '④ 刷新后 profile 选择保留（水彩海报 v3）',
    (await profileSelectPresent()) &&
      (await page.evaluate(
        () =>
          document
            .querySelector('[data-test-id="chat-style-profile-select"]')
            ?.textContent?.includes('水彩海报 v3') ?? false
      ))
  )

  // ── ⑤ 切回 ui：profile 下拉消失，发送体 chatMode=ui
  await page.getByTestId('chat-mode-select').click()
  await page.getByRole('option', { name: 'UI design' }).click()
  check('⑤ 切回 ui 后 profile 下拉消失', !(await profileSelectPresent()))
  const backToUi = await sendChat('t24 back to ui message')
  await waitEcho()
  check('⑤ 切回 ui 后发送体 chatMode=ui', backToUi?.chatMode === 'ui', backToUi?.chatMode)

  // ── ⑥ manifest 拉取失败 → profile 下拉禁用空态降级（C5 失败路径）
  // browser.newPage 是全新 context（localStorage 干净、无恢复对话框）；
  // 本页只拦 manifest（abort），聊天路由不需要——不切模式发送
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page2.on('pageerror', (err) => console.error(`[page2 pageerror] ${String(err).slice(0, 200)}`))
  await page2.route('**/api/pi/studio/manifest', (route) => route.abort())
  await page2.goto(base, { waitUntil: 'domcontentloaded' })
  await page2.getByRole('tab', { name: '设计' }).waitFor({ timeout: 20000 })
  await page2.getByTestId('properties-tab-ai').click()
  await page2.getByTestId('chat-mode-select').click()
  await page2.getByRole('option', { name: 'Marketing' }).click()
  const failedProfileTrigger = page2.getByTestId('chat-style-profile-select')
  await failedProfileTrigger.waitFor({ timeout: 10000 })
  const degradedDisabled = await failedProfileTrigger.evaluate(
    (el) => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
  )
  check('⑥ manifest 拉取失败 → profile 下拉禁用空态降级', degradedDisabled)
  const stillNoProfile = await page2.evaluate(
    () =>
      document
        .querySelector('[data-test-id="chat-style-profile-select"]')
        ?.textContent?.includes('Style profile') ?? false
  )
  check('⑥ 降级空态触发器文案 = 占位 "Style profile"', stillNoProfile)
} finally {
  await browser.close()
  // 选择态是 localStorage 持久化——冒烟用的 playwright 独立 profile 随浏览器关闭即弃，
  // 无需清理；发送均被 route 拦截，后端零写入
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
