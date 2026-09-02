/**
 * T66 P4/P5：generate_image 工具契约钉扎——
 * - parameters schema 化（八字段 Type.Array(Type.Object)，additionalProperties
 *   false）：四类常见错误（字段拼错/类型错误/嵌套错误/枚举错误）在 pi 运行时
 *   schema 校验期（pi-ai validateToolArguments，execute 之前）即拒绝并回执
 *   模型自纠；此处直接用 typebox Value.Check 钉 schema 本身的拒绝形状。
 *   注意：运行时在校验前先 Value.Convert（如 "1080" → 1080 的宽容转型属
 *   框架行为），本测试钉的是 schema 严格形状。
 *   T77 P7：background 由 provider 侧固定，schema 删除该字段（八字段）。
 * - description 瘦身至 2000 字符内（P5）。
 */
import { describe, expect, test } from 'bun:test'

import { Value } from 'typebox/value'

import type { ImageGenCredentialStore } from '@/app/ai/pi-backend/image-gen/credentials'
import {
  createImageGenTool,
  GENERATE_IMAGE_DESCRIPTION,
  GENERATE_IMAGE_PARAMETERS
} from '@/app/ai/pi-backend/image-gen/generate'

const VALID_NEW_IMAGE = { prompt: 'hero shot', width: 1080, height: 1080 }
const VALID_REPLACE = {
  prompt: 'swap background',
  replace_id: '0:7',
  references: [{ id: '0:7' }, { id: '0:9', composite: true }],
  quality: 'high',
  output_format: 'jpeg',
  output_compression: 80
}

describe('generate_image 工具 schema（P4）', () => {
  test('合法载荷通过（新建 + 替换八字段全集）', () => {
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, { requests: [VALID_NEW_IMAGE] })).toBe(true)
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, { requests: [VALID_REPLACE] })).toBe(true)
  })

  test('字段拼错拒绝：target_id ≠ replace_id（additionalProperties: false）', () => {
    const typo = { requests: [{ ...VALID_NEW_IMAGE, target_id: '0:7' }] }
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, typo)).toBe(false)
    // 嵌套对象的拼错同样拒绝
    const nestedTypo = {
      requests: [{ ...VALID_NEW_IMAGE, references: [{ id: '0:7', asImage: true }] }]
    }
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, nestedTypo)).toBe(false)
  })

  test('类型错误拒绝：width 必须是数字而非字符串', () => {
    const wrongType = { requests: [{ prompt: 'a', width: '1080', height: 1080 }] }
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, wrongType)).toBe(false)
  })

  test('嵌套错误拒绝：references 必须是 {id, composite?} 对象数组而非字符串数组', () => {
    const wrongNesting = { requests: [{ ...VALID_NEW_IMAGE, references: ['0:7'] }] }
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, wrongNesting)).toBe(false)
  })

  test('枚举错误拒绝：quality/output_format 均为字面量联合（T77 P7：background 已不在 schema）', () => {
    expect(
      Value.Check(GENERATE_IMAGE_PARAMETERS, {
        requests: [{ ...VALID_NEW_IMAGE, quality: 'best' }]
      })
    ).toBe(false)
    expect(
      Value.Check(GENERATE_IMAGE_PARAMETERS, {
        requests: [{ ...VALID_NEW_IMAGE, output_format: 'gif' }]
      })
    ).toBe(false)
    // T77 P7：background 由 provider 侧固定、不暴露给工具层——传 background
    // 现在触发 additionalProperties: false 拒绝（未知字段），不再走枚举校验。
    expect(
      Value.Check(GENERATE_IMAGE_PARAMETERS, {
        requests: [{ ...VALID_NEW_IMAGE, background: 'transparent' }]
      })
    ).toBe(false)
  })

  test('prompt 必填；requests 必须为数组', () => {
    expect(
      Value.Check(GENERATE_IMAGE_PARAMETERS, { requests: [{ width: 1024, height: 1024 }] })
    ).toBe(false)
    expect(Value.Check(GENERATE_IMAGE_PARAMETERS, { requests: '[{"prompt":"a"}]' })).toBe(false)
  })
})

describe('generate_image description（P5：瘦身 <2000 字符）', () => {
  test('长度上限钉扎', () => {
    expect(GENERATE_IMAGE_DESCRIPTION.length).toBeLessThan(2000)
  })

  test('关键行为语义保留（replace/references/批量/缺 key 引导）', () => {
    expect(GENERATE_IMAGE_DESCRIPTION).toContain('replace_id')
    expect(GENERATE_IMAGE_DESCRIPTION).toContain('references')
    expect(GENERATE_IMAGE_DESCRIPTION).toContain('ONE call')
    expect(GENERATE_IMAGE_DESCRIPTION).toContain('401')
  })

  test('工具装配后 description/parameters 透传', () => {
    const store: ImageGenCredentialStore = {
      get: () => null,
      set: () => undefined,
      clear: () => undefined,
      status: () => ({ configured: false }),
      reloadForTests: () => undefined,
      exists: () => false
    }
    const tool = createImageGenTool({ credentials: store })
    expect(tool.description).toBe(GENERATE_IMAGE_DESCRIPTION)
    expect(tool.parameters).toBe(GENERATE_IMAGE_PARAMETERS)
  })
})
