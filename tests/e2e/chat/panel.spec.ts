import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

// T25：pi 单通道后的 chat 面板 e2e——旧 provider 设置门/模型选择器/附件流
// 已随旧面切除；transport 经 window.openPencil.setChatTransport 注入 mock
// （与 pi attach 同一条 override 管道，D4 保留钩子）。
const USE_REAL_LLM = process.env.TEST_REAL_LLM === '1'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  await page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('dark')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  if (!USE_REAL_LLM) {
    await injectMockTransport(page)
  }
})

test.afterAll(async () => {
  await page.close()
})

async function injectMockTransport(page: Page) {
  await page.evaluate(() => {
    const setChatTransport = window.openPencil?.setChatTransport
    if (!setChatTransport) throw new Error('Transport override not available')

    let msgCounter = 0

    setChatTransport(() => ({
      async sendMessages({
        messages
      }: {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>
      }) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const text = lastUser?.parts?.find((p) => p.type === 'text')?.text ?? ''
        const msgId = `mock-msg-${++msgCounter}`
        const lowerText = text.toLowerCase()
        const wantsTool = lowerText.includes('frame') || lowerText.includes('rectangle')
        const wantsCode = lowerText.includes('code block')

        if (lowerText.includes('missing agent')) {
          throw new Error(
            '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
          )
        }

        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: msgId })

            if (wantsTool) {
              const toolCallId = `call-${msgId}`
              controller.enqueue({
                type: 'tool-input-start',
                toolCallId,
                toolName: 'create_shape'
              })
              controller.enqueue({
                type: 'tool-input-delta',
                toolCallId,
                inputTextDelta:
                  '{"type":"FRAME","x":100,"y":100,"width":200,"height":150,"name":"Card"}'
              })
              controller.enqueue({
                type: 'tool-input-available',
                toolCallId,
                toolName: 'create_shape',
                input: { type: 'FRAME', x: 100, y: 100, width: 200, height: 150, name: 'Card' }
              })
              controller.enqueue({
                type: 'tool-output-available',
                toolCallId,
                toolName: 'create_shape',
                output: {
                  id: '0:99',
                  type: 'FRAME',
                  x: 100,
                  y: 100,
                  width: 200,
                  height: 150,
                  name: 'Card'
                }
              })
            }

            let words: string[]
            if (wantsTool) words = ['Created', 'a', 'frame', 'called', '"Card".']
            else if (wantsCode) words = ['```typescript\nconst greeting = "Hello"\n```']
            else words = `I'll help you with: "${text}". Here's a mock response.`.split(' ')

            controller.enqueue({ type: 'text-start', id: 'text-1' })
            for (const word of words) {
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: word + ' ' })
            }
            controller.enqueue({ type: 'text-end', id: 'text-1' })
            controller.enqueue({ type: 'finish', finishReason: 'stop' })
            controller.close()
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  })
}

function chatTab() {
  return page.getByRole('tab', { name: 'AI' })
}

function designTab() {
  return page.getByRole('tab', { name: 'Design' })
}

function chatInput() {
  return page.getByRole('textbox', { name: 'Describe a change' })
}

test('⌘J switches to AI tab', async () => {
  await designTab().waitFor()
  await page.keyboard.press('ControlOrMeta+j')
  await expect(chatTab()).toHaveAttribute('data-state', 'active')
})

test('⌘J switches back to Design tab', async () => {
  await page.keyboard.press('ControlOrMeta+j')
  await expect(designTab()).toHaveAttribute('data-state', 'active')
})

test('chat interface is available without provider setup (pi 单通道无设置门)', async () => {
  await chatTab().click()
  await expect(chatInput()).toBeVisible()
  await expect(page.getByText('Describe what you want to create or change.')).toBeVisible()
  // T25：pi 模型标签 + 模式选择器常驻；style profile 选择器仅 marketing 模式
  // （mode-overlay-bind 冒烟覆盖）；旧 ProviderSetup 门不存在
  await expect(page.getByTestId('chat-pi-model-label')).toBeVisible()
  await expect(page.getByTestId('chat-mode-select')).toBeVisible()
  await expect(page.getByTestId('chat-style-profile-select')).toHaveCount(0)
  await expect(page.getByTestId('provider-setup-open-settings')).toHaveCount(0)
})

test('empty input has disabled send button', async () => {
  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeDisabled()
})

test('typing enables send button', async () => {
  await chatInput().fill('Make a red rectangle')
  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeEnabled()
})

test('Shift+Enter inserts a line break without submitting', async () => {
  await chatInput().fill('First line')
  await chatInput().press('Shift+Enter')
  await chatInput().type('Second line')

  await expect(chatInput()).toHaveValue('First line\nSecond line')
  await expect(page.getByText('First line', { exact: true })).toBeHidden()
})

test('Enter submits message and clears input', async () => {
  await chatInput().fill('Hello there')
  await chatInput().press('Enter')

  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(chatInput()).toHaveValue('')
})

test('assistant responds', async () => {
  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    await expect(page.getByText('mock response', { exact: false })).toBeVisible({ timeout: 5000 })
  }
})

test('completed Markdown responses release streaming parser history', async () => {
  await chatInput().fill('Show a code block')
  await chatInput().press('Enter')

  const markdown = page.locator('.chat-markdown').last()
  await expect(markdown).toBeVisible()
  await expect(markdown).toHaveAttribute('data-chat-markdown-mode', 'static')
  await expect(markdown.locator('.shiki').first()).toBeVisible()
})

test('assistant code blocks follow the active theme with readable contrast', async () => {
  await chatInput().fill('Show a code block')
  await chatInput().press('Enter')

  const code = page.getByTestId('chat-message-assistant').last().locator('.shiki').first()
  await expect(code).toBeVisible()
  await expect(page.locator('.chat-markdown').last()).toHaveClass(/dark/)
  await expect(code).toHaveCSS('background-color', 'rgb(30, 30, 30)')
  await expect(code.locator('span').filter({ hasText: 'const' }).first()).not.toHaveCSS(
    'color',
    'rgb(240, 240, 240)'
  )
  await page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('light')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await expect(page.locator('.chat-markdown').last()).toHaveClass(/light/)
  await expect(code).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('tool calls render in assistant message', async () => {
  await chatInput().fill('Create a frame')
  await chatInput().press('Enter')

  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    await expect(page.getByText('Create Shape')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Done')).toBeVisible()
    await expect(page.getByText('Created a frame', { exact: false })).toBeVisible()
  }
})

test('switching tabs preserves chat', async () => {
  await designTab().click({ timeout: 10000 })
  await expect(designTab()).toHaveAttribute('data-state', 'active')

  await chatTab().click()
  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('transport errors show a safe localized toast', async () => {
  await chatInput().fill('Trigger missing agent error')
  await chatInput().press('Enter')

  await expect(
    page.getByTestId('toast-item').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible({ timeout: 5000 })
})
