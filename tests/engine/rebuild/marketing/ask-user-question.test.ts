/**
 * T56（Phase 3 W2/T-B5）：ask_user_question 校验矩阵 + awaiting 信封 + formId 模式 +
 * Case B 四项组合 + 答案信封序列化/解析 round-trip（验收锚 T56-plan §3.1）。
 *
 * core 层（#core/tools/fork/marketing/ask-user-question）纯函数直测；
 * pi 工具工厂（@/app/ai/pi-backend/ask-user-question）经注入确定性 formId 钉
 * awaiting 信封字段与软终止指令文本。
 */
import { describe, expect, test } from 'bun:test'

import {
  FORM_ID_PATTERN,
  makeFormId,
  parseAskAnswer,
  serializeAskAnswer,
  validateAskUserQuestions
} from '@open-pencil/core/tools/fork/marketing/ask-user-question'

import { createAskUserQuestionTool } from '@/app/ai/pi-backend/ask-user-question'

function singleSelect(id: string) {
  return {
    id,
    kind: 'single_select',
    label: `问题 ${id}`,
    options: [
      { id: 'a', label: '选项 A', hint: '提示' },
      { id: 'b', label: '选项 B' }
    ]
  }
}

describe('validateAskUserQuestions 校验矩阵', () => {
  test('合法 single_select 通过；required 缺省补 true；选项 trim 归一', () => {
    const result = validateAskUserQuestions({ questions: [singleSelect('q1')] })
    expect('questions' in result).toBe(true)
    if (!('questions' in result)) return
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].required).toBe(true)
    expect(result.questions[0].options).toHaveLength(2)
  })

  test('questions 非数组 / 0 条 / 9 条 → {error, message} 不 throw', () => {
    for (const input of [{}, { questions: 'nope' }, { questions: [] }]) {
      const result = validateAskUserQuestions(input)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('questions_bounds')
        expect(typeof result.message).toBe('string')
      }
    }
    const nine = {
      questions: Array.from({ length: 9 }, (_, i) => singleSelect(`q${i}`))
    }
    expect('error' in validateAskUserQuestions(nine)).toBe(true)
  })

  test('8 条边界通过', () => {
    const eight = {
      questions: Array.from({ length: 8 }, (_, i) => singleSelect(`q${i}`))
    }
    expect('questions' in validateAskUserQuestions(eight)).toBe(true)
  })

  test('id 空 / 重复 → error', () => {
    expect(
      'error' in validateAskUserQuestions({ questions: [{ ...singleSelect(''), id: '  ' }] })
    ).toBe(true)
    const dup = validateAskUserQuestions({
      questions: [singleSelect('q1'), singleSelect('q1')]
    })
    expect('error' in dup).toBe(true)
    if ('error' in dup) expect(dup.error).toBe('question_id')
  })

  test('label 空 → error', () => {
    const result = validateAskUserQuestions({
      questions: [{ ...singleSelect('q1'), label: ' ' }]
    })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('question_label')
  })

  test('非法 kind → error', () => {
    const result = validateAskUserQuestions({
      questions: [{ id: 'q1', kind: 'multi_select', label: 'x' }]
    })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('question_kind')
  })

  test('single_select：options 1 个 / 13 个 / 缺失 → error；携带 imageOptions → error', () => {
    const one = validateAskUserQuestions({
      questions: [{ ...singleSelect('q1'), options: [{ id: 'a', label: 'A' }] }]
    })
    expect('error' in one).toBe(true)
    const thirteen = validateAskUserQuestions({
      questions: [
        {
          ...singleSelect('q1'),
          options: Array.from({ length: 13 }, (_, i) => ({ id: `o${i}`, label: `O${i}` }))
        }
      ]
    })
    expect('error' in thirteen).toBe(true)
    expect(
      'error' in
        validateAskUserQuestions({ questions: [{ id: 'q1', kind: 'single_select', label: 'x' }] })
    ).toBe(true)
    const mixed = validateAskUserQuestions({
      questions: [{ ...singleSelect('q1'), imageOptions: [{ nodeId: '0:1' }] }]
    })
    expect('error' in mixed).toBe(true)
    if ('error' in mixed) expect(mixed.error).toBe('kind_mixed_fields')
  })

  test('single_select：option id 重复 / 空 → error', () => {
    const dup = validateAskUserQuestions({
      questions: [
        {
          ...singleSelect('q1'),
          options: [
            { id: 'a', label: 'A' },
            { id: 'a', label: 'B' }
          ]
        }
      ]
    })
    expect('error' in dup).toBe(true)
    const empty = validateAskUserQuestions({
      questions: [
        {
          ...singleSelect('q1'),
          options: [
            { id: '', label: 'A' },
            { id: 'b', label: 'B' }
          ]
        }
      ]
    })
    expect('error' in empty).toBe(true)
  })

  test('image_select：imageOptions 0 个 / 13 个 / nodeId 空 → error；携带 options → error', () => {
    const base = { id: 'q1', kind: 'image_select', label: '选一帧' }
    expect(
      'error' in validateAskUserQuestions({ questions: [{ ...base, imageOptions: [] }] })
    ).toBe(true)
    const thirteen = validateAskUserQuestions({
      questions: [
        { ...base, imageOptions: Array.from({ length: 13 }, (_, i) => ({ nodeId: `0:${i}` })) }
      ]
    })
    expect('error' in thirteen).toBe(true)
    const emptyNode = validateAskUserQuestions({
      questions: [{ ...base, imageOptions: [{ nodeId: ' ' }] }]
    })
    expect('error' in emptyNode).toBe(true)
    if ('error' in emptyNode) expect(emptyNode.error).toBe('image_option_node')
    const mixed = validateAskUserQuestions({
      questions: [
        { ...base, imageOptions: [{ nodeId: '0:1' }], options: [{ id: 'a', label: 'A' }] }
      ]
    })
    expect('error' in mixed).toBe(true)
    if ('error' in mixed) expect(mixed.error).toBe('kind_mixed_fields')
  })

  test('image_select 合法：1 个候选即过，label 可选', () => {
    const result = validateAskUserQuestions({
      questions: [
        { id: 'q1', kind: 'image_select', label: '选一帧', imageOptions: [{ nodeId: '0:1' }] }
      ]
    })
    expect('questions' in result).toBe(true)
  })

  test('text：携带 options/imageOptions → error；required:false 保留', () => {
    const withOptions = validateAskUserQuestions({
      questions: [{ id: 'q1', kind: 'text', label: 'x', options: singleSelect('q').options }]
    })
    expect('error' in withOptions).toBe(true)
    const result = validateAskUserQuestions({
      questions: [{ id: 'q1', kind: 'text', label: '补充说明', required: false }]
    })
    expect('questions' in result).toBe(true)
    if (!('questions' in result)) return
    expect(result.questions[0].required).toBe(false)
  })
})

describe('Case B 复用锚：四项 payload（现有 kinds 组合）通过校验', () => {
  test('①旧设计保留声明 ②新模式新设计区 ③携带物逐项勾选 ④废弃半径声明', () => {
    const caseB = {
      questions: [
        {
          id: 'keep_old_design',
          kind: 'single_select',
          label: '旧设计是否保留？',
          options: [
            { id: 'keep', label: '保留旧设计' },
            { id: 'discard', label: '废弃旧设计' }
          ]
        },
        {
          id: 'new_design_zone',
          kind: 'single_select',
          label: '新模式的新设计区放在哪里？',
          options: [
            { id: 'right', label: '旧设计右侧' },
            { id: 'below', label: '旧设计下方' },
            { id: 'new_page', label: '新页面' }
          ]
        },
        {
          id: 'carry_items',
          kind: 'text',
          label: '逐项列出要携带进新模式的内容',
          required: false
        },
        {
          id: 'discard_radius',
          kind: 'single_select',
          label: '废弃半径声明（换模式时丢弃哪些内容）',
          options: [
            { id: 'current_design', label: '仅当前设计' },
            { id: 'whole_page', label: '整个页面', hint: '谨慎选择' }
          ]
        }
      ]
    }
    const result = validateAskUserQuestions(caseB)
    expect('questions' in result).toBe(true)
    if (!('questions' in result)) return
    expect(result.questions).toHaveLength(4)
    expect(result.questions[2].required).toBe(false)
  })
})

describe('makeFormId', () => {
  test('模式钉扎：form-<时间戳36进制>-<随机6位>', () => {
    expect(
      makeFormId(
        () => 0,
        () => 0
      )
    ).toBe('form-0-000000')
    expect(
      makeFormId(
        () => Date.UTC(2026, 8, 1),
        () => 0.999999
      )
    ).toMatch(FORM_ID_PATTERN)
    expect(makeFormId()).toMatch(FORM_ID_PATTERN)
  })

  test('默认源两次生成不同', () => {
    expect(makeFormId()).not.toBe(makeFormId())
  })
})

describe('createAskUserQuestionTool：awaiting 信封（软终止）', () => {
  test('合法定义 → {formId, status:awaiting_user, questions 回显} + zh-cn 终止指令', async () => {
    const tool = createAskUserQuestionTool({ makeId: () => 'form-test-000000' })
    const input = { questions: [singleSelect('q1'), { id: 'q2', kind: 'text', label: '补充' }] }
    // 先例：orchestration.test.ts 以双参直调 execute（signal/onUpdate/ctx 省略）
    const result = await tool.execute('call-1', input)

    const details = result.details as {
      formId: string
      status: string
      questions: Array<{ id: string; required: boolean }>
    }
    expect(details.formId).toBe('form-test-000000')
    expect(details.status).toBe('awaiting_user')
    expect(details.questions.map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(details.questions[1].required).toBe(true)

    const text = result.content[0].type === 'text' ? result.content[0].text : ''
    expect(text).toContain('formId=form-test-000000')
    expect(text).toContain('回合到此结束')
    expect(text).toContain('[表单作答 formId=')
  })

  test('非法定义 → {error, message}，无 formId', async () => {
    const tool = createAskUserQuestionTool({ makeId: () => 'form-test-000000' })
    const result = await tool.execute('call-1', { questions: [] })
    const details = result.details as { error?: string; message?: string; formId?: string }
    expect(details.error).toBe('questions_bounds')
    expect(typeof details.message).toBe('string')
    expect(details.formId).toBeUndefined()
  })
})

describe('答案信封 serializeAskAnswer/parseAskAnswer round-trip', () => {
  test('作答信封：首行标记 + JSON 行，解析还原', () => {
    const text = serializeAskAnswer('form-abc-000000', {
      aborted: false,
      answers: { q1: 'a', q2: '自由文本' }
    })
    expect(text.startsWith('[表单作答 formId=form-abc-000000]\n')).toBe(true)
    expect(parseAskAnswer(text)).toEqual({
      formId: 'form-abc-000000',
      aborted: false,
      answers: { q1: 'a', q2: '自由文本' }
    })
  })

  test('跳过信封：aborted:true + freeText', () => {
    const text = serializeAskAnswer('form-abc-000000', { aborted: true, freeText: '都不想选' })
    expect(text.startsWith('[表单跳过 formId=form-abc-000000]\n')).toBe(true)
    expect(parseAskAnswer(text)).toEqual({
      formId: 'form-abc-000000',
      aborted: true,
      freeText: '都不想选'
    })
  })

  test('容错：坏 JSON / 缺标记行 / 单行文本 → null', () => {
    expect(parseAskAnswer('[表单作答 formId=x]\n{not json')).toBeNull()
    expect(parseAskAnswer('普通用户消息\n{"aborted":false,"answers":{}}')).toBeNull()
    expect(parseAskAnswer('[表单作答 formId=x]')).toBeNull()
    expect(parseAskAnswer('')).toBeNull()
  })

  test('容错：aborted 与标记不符 / JSON 非对象 → null', () => {
    expect(parseAskAnswer('[表单作答 formId=x]\n{"aborted":true,"freeText":"y"}')).toBeNull()
    expect(parseAskAnswer('[表单跳过 formId=x]\n{"aborted":false,"answers":{}}')).toBeNull()
    expect(parseAskAnswer('[表单作答 formId=x]\n[1,2]')).toBeNull()
    expect(parseAskAnswer('[表单作答 formId=x]\n"str"')).toBeNull()
  })

  test('容错：answers 非字符串值过滤；freeText 缺失补空串；标记行尾空白容忍', () => {
    expect(
      parseAskAnswer('[表单作答 formId=x] \n{"aborted":false,"answers":{"a":1,"b":"ok"}}')
    ).toEqual({ formId: 'x', aborted: false, answers: { b: 'ok' } })
    expect(parseAskAnswer('[表单跳过 formId=x]\n{"aborted":true}')).toEqual({
      formId: 'x',
      aborted: true,
      freeText: ''
    })
  })
})
