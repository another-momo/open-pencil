/**
 * T54：凭证链钉扎（验收锚 T54-plan §3.1/§3.2）——
 * 空 key 清除生效（00 #7）；默认无第三方中转 baseURL（08 P0-5b）；
 * 三键存储 + 状态脱敏（status 不回 key）；预设校验。
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createImageGenCredentialStore } from '@/app/ai/pi-backend/image-gen/credentials'
import {
  DEFAULT_IMAGE_GEN_PRESET_ID,
  findImageGenPreset,
  IMAGE_GEN_PRESETS
} from '@/app/ai/pi-backend/image-gen/presets'

function tempAgentDir(): { agentDir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'openpencil-imagegen-test-'))
  return { agentDir: dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('凭证预设表', () => {
  test('默认预设 = OpenAI 官方端点（默认不指向任何第三方中转）', () => {
    const preset = findImageGenPreset(DEFAULT_IMAGE_GEN_PRESET_ID)
    expect(preset).toBeDefined()
    expect(preset?.baseUrl).toBe('https://api.openai.com/v1')
    // 防回归：默认预设不得是第三方中转域名
    expect(preset?.baseUrl).not.toContain('dmxapi')
  })

  test('DMX 是可选预设而非默认', () => {
    const dmx = IMAGE_GEN_PRESETS.find((preset) => preset.id === 'dmx')
    expect(dmx?.baseUrl).toBe('https://www.dmxapi.cn/v1')
    expect(dmx?.model).toBe('gpt-image-2-ssvip')
    expect(DEFAULT_IMAGE_GEN_PRESET_ID).not.toBe('dmx')
  })
})

describe('凭证存储', () => {
  test('未配置 → get() null / status.configured=false（无隐式 baseURL）', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      expect(store.get()).toBeNull()
      expect(store.status()).toEqual({ configured: false })
      expect(store.exists()).toBe(false)
    } finally {
      cleanup()
    }
  })

  test('set 三键落盘；status 脱敏不回 key', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set({ presetId: 'dmx', apiKey: 'sk-secret-imagegen' })
      const credentials = store.get()
      expect(credentials).toEqual({
        presetId: 'dmx',
        baseUrl: 'https://www.dmxapi.cn/v1',
        model: 'gpt-image-2-ssvip',
        apiKey: 'sk-secret-imagegen'
      })
      const status = store.status()
      expect(status.configured).toBe(true)
      expect(status.presetId).toBe('dmx')
      expect(JSON.stringify(status)).not.toContain('sk-secret-imagegen')
      // 落盘文件存在且为 JSON（权限位 win 下不可断言 0o600，只断言存在与内容）
      const raw = JSON.parse(readFileSync(join(agentDir, 'image-gen.json'), 'utf8')) as {
        apiKey?: string
      }
      expect(raw.apiKey).toBe('sk-secret-imagegen')
    } finally {
      cleanup()
    }
  })

  test('空 key 清除生效（00 #7：set 空串 = clear，文件移除）', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set({ presetId: 'openai', apiKey: 'sk-to-be-cleared' })
      expect(store.get()).not.toBeNull()
      store.set({ presetId: 'openai', apiKey: '' })
      expect(store.get()).toBeNull()
      expect(store.status().configured).toBe(false)
      expect(existsSync(join(agentDir, 'image-gen.json'))).toBe(false)
      // 全空白同义
      store.set({ presetId: 'openai', apiKey: 'sk-again' })
      store.set({ presetId: 'openai', apiKey: '   ' })
      expect(store.get()).toBeNull()
    } finally {
      cleanup()
    }
  })

  test('clear() 幂等（未配置时调用不炸）', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.clear()
      expect(store.get()).toBeNull()
    } finally {
      cleanup()
    }
  })

  test('未知预设拒绝', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      expect(() => store.set({ presetId: 'evil-relay', apiKey: 'sk-x' })).toThrow(
        '未知生图服务商预设'
      )
      expect(store.get()).toBeNull()
    } finally {
      cleanup()
    }
  })

  test('key 含空白字符拒绝（HTTP 头不可携带）', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      expect(() => store.set({ presetId: 'openai', apiKey: 'sk-has space' })).toThrow('空白字符')
    } finally {
      cleanup()
    }
  })

  test('跨进程持久化：reloadForTests 后从盘上读回', () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set({ presetId: 'openai', apiKey: 'sk-persist' })
      store.reloadForTests()
      expect(store.get()?.apiKey).toBe('sk-persist')
      // 新 store 实例（模拟进程重启）同读
      const fresh = createImageGenCredentialStore({ agentDir })
      expect(fresh.get()?.apiKey).toBe('sk-persist')
    } finally {
      cleanup()
    }
  })
})
