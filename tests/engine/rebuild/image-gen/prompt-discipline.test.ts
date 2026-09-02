/**
 * T82：生图 prompt 规则迁回 profile——tool description 不再承载 prompt 规则；
 * profile（studio/base.md + transcribe 同步源 prompts/system-prompt-base.md）
 * 承载。钉四个方向：profile 有新规则 + transcribe 同步 + tool description
 * 不含 prompt 规则 + schema 字段 hint 不含。
 */
import { describe, expect, test } from 'bun:test'

import {
  GENERATE_IMAGE_DESCRIPTION,
  GENERATE_IMAGE_PARAMETERS
} from '@/app/ai/pi-backend/image-gen/generate'

import { repoPath } from '#tests/helpers/paths'

const STUDIO_BASE_PATH = 'src/app/ai/pi-backend/studio/base.md'
const PROMPT_BASE_PATH = 'src/app/ai/pi-backend/prompts/system-prompt-base.md'

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return await Bun.file(repoPath(relativePath)).text()
}

describe('T82 prompt 规则归宿', () => {
  test('profile (studio/base.md) 含 generate_image 不渲染文字规则', async () => {
    const text = await readWorkspaceFile(STUDIO_BASE_PATH)
    expect(text).toContain('generate_image')
    expect(text).toMatch(/no rendered text|rendered text/i)
  })

  test('transcribe 同步源 (prompts/system-prompt-base.md) 含同样规则', async () => {
    const text = await readWorkspaceFile(PROMPT_BASE_PATH)
    expect(text).toContain('generate_image')
    expect(text).toMatch(/no rendered text|rendered text/i)
  })

  test('生图 tool description 不再承载 prompt 规则（卸完）', () => {
    expect(GENERATE_IMAGE_DESCRIPTION).not.toContain('rendered text')
    expect(GENERATE_IMAGE_DESCRIPTION).not.toContain('garbled')
    expect(GENERATE_IMAGE_DESCRIPTION).not.toContain('wrong-language')
  })

  test('prompt 字段 schema description 不再承载 prompt 规则', () => {
    // typebox: GENERATE_IMAGE_PARAMETERS.properties.requests.items.properties.prompt.description
    // —— schema 字段 hint 应只承载事实（"Text prompt"），不含 prompt 规则。
    // 单层断言（避开 no-broad-double-cast）。
    const schema = GENERATE_IMAGE_PARAMETERS as {
      properties: {
        requests: {
          items: { properties: { prompt: { description: string } } }
        }
      }
    }
    const promptDescription = schema.properties.requests.items.properties.prompt.description
    expect(promptDescription).not.toContain('rendered text')
  })
})
