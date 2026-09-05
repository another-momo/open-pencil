/**
 * T82：生图 prompt 规则迁回 profile——tool description 不再承载 prompt 规则。
 * 2026-09-05 owner 决议修订：「生成图片不含文字」这类限制**只能出现在
 * workflow/profile 里**，任何通用性提示词（studio/base.md 等行为基座）不得
 * 承载——通用禁令会限制生图发挥空间。transcribe 双源同步随之退役，
 * prompts/system-prompt-base.md 已删除，studio/ 目录是唯一真源。
 * 钉四个方向：base 不含禁令 + 禁令只能活在 workflow/profile + tool
 * description 不含 + schema 字段 hint 不含。
 */
import { describe, expect, test } from 'bun:test'

import {
  GENERATE_IMAGE_DESCRIPTION,
  GENERATE_IMAGE_PARAMETERS
} from '@/app/ai/pi-backend/image-gen/generate'

import { repoPath } from '#tests/helpers/paths'

const STUDIO_BASE_PATH = 'src/app/ai/pi-backend/studio/base.md'
const PI_BACKEND_DIR = 'src/app/ai/pi-backend'
/** 禁令指纹：生图渲染文字限制（base.md 的语言质量条款不含此字面） */
const TEXT_BAN_PATTERN = /rendered text/i
/** 允许承载禁令的子树：workflow 与 profile */
const ALLOWED_PREFIXES = ['studio/workflows/', 'studio/profiles/']

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return await Bun.file(repoPath(relativePath)).text()
}

describe('T82 prompt 规则归宿', () => {
  test('通用行为基座 (studio/base.md) 不承载生图文字禁令', async () => {
    const text = await readWorkspaceFile(STUDIO_BASE_PATH)
    expect(text).not.toMatch(TEXT_BAN_PATTERN)
  })

  test('生图文字禁令只能出现在 workflow/profile 文件中', async () => {
    const glob = new Bun.Glob('**/*.md')
    const offenders: string[] = []
    for await (const file of glob.scan({ cwd: repoPath(PI_BACKEND_DIR) })) {
      const text = await Bun.file(repoPath(`${PI_BACKEND_DIR}/${file}`)).text()
      if (!TEXT_BAN_PATTERN.test(text)) continue
      if (!ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) offenders.push(file)
    }
    expect(offenders).toEqual([])
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
