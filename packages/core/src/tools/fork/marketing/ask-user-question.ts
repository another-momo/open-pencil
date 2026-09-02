/**
 * T56（Phase 3 W2/T-B5）：ask_user_question 表单定义纯函数层——全新建
 * （旧仓无先例，T56-plan §1 定谳 1 双件布局的 core 件）。
 *
 * 职责：
 *  - 表单定义校验（validateAskUserQuestions）：questions 1..8、id 唯一非空、
 *    label 非空、kind 三值互斥（single_select → options 2..12 且无 imageOptions；
 *    image_select → imageOptions 1..12 且无 options；text 两者皆无）、
 *    required 缺省 true。失败返回 { error, message }，不 throw——
 *    pi 后端 execute 与前端卡片渲染共用本层。
 *  - formId 生成（makeFormId）：`form-<时间戳36进制>-<随机6位>`，now/rand 可注入
 *    （测试确定性）。
 *  - 答案信封序列化/解析（serializeAskAnswer/parseAskAnswer）：用户消息文本
 *    首行 `[表单作答 formId=…]` / `[表单跳过 formId=…]` + 次行 JSON
 *    （{"aborted":false,"answers":{…}} / {"aborted":true,"freeText":"…"}），
 *    解析容错——坏 JSON/缺标记行/类型不符 → null。
 *
 * 纯函数、零 figma/pi 依赖——bun 直接可测。
 */

export type AskQuestionKind = 'single_select' | 'image_select' | 'text'

export interface AskSelectOption {
  id: string
  label: string
  hint?: string
}

export interface AskImageOption {
  nodeId: string
  label?: string
}

/** 校验归一后的表单题（required 已填缺省值 true） */
export interface AskQuestionSpec {
  id: string
  kind: AskQuestionKind
  label: string
  required: boolean
  options?: AskSelectOption[]
  imageOptions?: AskImageOption[]
}

export type AskValidation = { questions: AskQuestionSpec[] } | { error: string; message: string }

export const ASK_QUESTION_LIMITS = {
  questions: { min: 1, max: 8 },
  options: { min: 2, max: 12 },
  imageOptions: { min: 1, max: 12 },
  labelMaxLength: 2000
} as const

function fail(error: string, message: string): { error: string; message: string } {
  return { error, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function validateSelectOptions(
  questionId: string,
  value: unknown
): AskSelectOption[] | { error: string; message: string } {
  if (
    !Array.isArray(value) ||
    value.length < ASK_QUESTION_LIMITS.options.min ||
    value.length > ASK_QUESTION_LIMITS.options.max
  ) {
    return fail(
      'options_bounds',
      `question "${questionId}" (single_select) needs 2-12 options, got ${Array.isArray(value) ? value.length : typeof value}`
    )
  }
  const seen = new Set<string>()
  const options: AskSelectOption[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      return fail('option_shape', `question "${questionId}" options[${index}] must be an object`)
    }
    const id = nonEmptyString(item.id)
    const label = nonEmptyString(item.label)
    if (!id || !label) {
      return fail(
        'option_fields',
        `question "${questionId}" options[${index}] needs non-empty id and label`
      )
    }
    if (seen.has(id)) {
      return fail('option_id', `question "${questionId}" has duplicate option id "${id}"`)
    }
    seen.add(id)
    const hint = nonEmptyString(item.hint)
    options.push({ id, label, ...(hint ? { hint } : {}) })
  }
  return options
}

function validateImageOptions(
  questionId: string,
  value: unknown
): AskImageOption[] | { error: string; message: string } {
  if (
    !Array.isArray(value) ||
    value.length < ASK_QUESTION_LIMITS.imageOptions.min ||
    value.length > ASK_QUESTION_LIMITS.imageOptions.max
  ) {
    return fail(
      'image_options_bounds',
      `question "${questionId}" (image_select) needs 1-12 imageOptions, got ${Array.isArray(value) ? value.length : typeof value}`
    )
  }
  const imageOptions: AskImageOption[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      return fail(
        'image_option_shape',
        `question "${questionId}" imageOptions[${index}] must be an object`
      )
    }
    const nodeId = nonEmptyString(item.nodeId)
    if (!nodeId) {
      return fail(
        'image_option_node',
        `question "${questionId}" imageOptions[${index}] needs a non-empty nodeId`
      )
    }
    const label = nonEmptyString(item.label)
    imageOptions.push({ nodeId, ...(label ? { label } : {}) })
  }
  return imageOptions
}

function validateQuestion(
  item: unknown,
  index: number,
  seenIds: Set<string>
): AskQuestionSpec | { error: string; message: string } {
  if (!isRecord(item)) {
    return fail('question_shape', `questions[${index}] must be an object`)
  }
  const id = nonEmptyString(item.id)
  if (!id) return fail('question_id', `questions[${index}].id must be a non-empty string`)
  if (seenIds.has(id)) return fail('question_id', `duplicate question id "${id}"`)
  seenIds.add(id)

  const label = nonEmptyString(item.label)
  if (!label) return fail('question_label', `question "${id}" needs a non-empty label`)
  if (label.length > ASK_QUESTION_LIMITS.labelMaxLength) {
    return fail(
      'question_label_too_long',
      `question "${id}" label exceeds ${ASK_QUESTION_LIMITS.labelMaxLength} chars (got ${label.length})`
    )
  }

  const kind = item.kind
  if (kind !== 'single_select' && kind !== 'image_select' && kind !== 'text') {
    return fail(
      'question_kind',
      `question "${id}" kind must be single_select | image_select | text`
    )
  }
  const required = item.required !== false

  if (kind === 'single_select') {
    if (item.imageOptions !== undefined) {
      return fail(
        'kind_mixed_fields',
        `question "${id}" (single_select) must not carry imageOptions`
      )
    }
    const options = validateSelectOptions(id, item.options)
    if ('error' in options) return options
    return { id, kind, label, required, options }
  }
  if (kind === 'image_select') {
    if (item.options !== undefined) {
      return fail('kind_mixed_fields', `question "${id}" (image_select) must not carry options`)
    }
    const imageOptions = validateImageOptions(id, item.imageOptions)
    if ('error' in imageOptions) return imageOptions
    return { id, kind, label, required, imageOptions }
  }
  if (item.options !== undefined || item.imageOptions !== undefined) {
    return fail('kind_mixed_fields', `question "${id}" (text) must not carry options`)
  }
  return { id, kind, label, required }
}

/**
 * 校验并归一表单定义（required 缺省补 true，选项 trim 后回显）。
 * 输入为原始工具参数（{ questions: [...] }），失败返回 { error, message }。
 */
export function validateAskUserQuestions(input: unknown): AskValidation {
  const raw = isRecord(input) ? input : {}
  const list = raw.questions
  if (
    !Array.isArray(list) ||
    list.length < ASK_QUESTION_LIMITS.questions.min ||
    list.length > ASK_QUESTION_LIMITS.questions.max
  ) {
    return fail(
      'questions_bounds',
      `questions must be an array of 1-8 items, got ${Array.isArray(list) ? list.length : typeof list}`
    )
  }

  const seenIds = new Set<string>()
  const questions: AskQuestionSpec[] = []
  for (const [index, item] of list.entries()) {
    const question = validateQuestion(item, index, seenIds)
    if ('error' in question) return question
    questions.push(question)
  }
  return { questions }
}

// ── formId ──

export const FORM_ID_PATTERN = /^form-[0-9a-z]+-[0-9a-z]{6}$/

/** `form-<时间戳36进制>-<随机6位>`；now/rand 可注入（测试确定性） */
export function makeFormId(now: () => number = Date.now, rand: () => number = Math.random): string {
  const stamp = Math.max(0, Math.floor(now())).toString(36)
  const random = Math.floor(rand() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
  return `form-${stamp}-${random}`
}

// ── 答案信封（用户消息文本：首行标记 + 次行 JSON） ──

const ANSWER_MARKER = /^\[表单作答 formId=([^\]\s]+)\]\s*$/
const SKIP_MARKER = /^\[表单跳过 formId=([^\]\s]+)\]\s*$/

export type AskAnswerPayload =
  | { aborted: false; answers: Record<string, string> }
  | { aborted: true; freeText: string }

/** 前端提交路径用的完整载荷（formId + 判别联合） */
export type AskFormSubmission = { formId: string } & AskAnswerPayload

export function serializeAskAnswer(formId: string, payload: AskAnswerPayload): string {
  const marker = payload.aborted ? `[表单跳过 formId=${formId}]` : `[表单作答 formId=${formId}]`
  return `${marker}\n${JSON.stringify(payload)}`
}

export type ParsedAskAnswer = { formId: string } & AskAnswerPayload

/**
 * 解析答案信封——只认首行标记（ChatPanel answeredFormIds 派生同律）；
 * 坏 JSON、缺标记、aborted 与标记不符、JSON 非对象 → null（容错不 throw）。
 */
export function parseAskAnswer(text: string): ParsedAskAnswer | null {
  const newline = text.indexOf('\n')
  if (newline === -1) return null
  const firstLine = text.slice(0, newline)
  const answerMatch = ANSWER_MARKER.exec(firstLine)
  const skipMatch = SKIP_MARKER.exec(firstLine)
  if (!answerMatch && !skipMatch) return null
  const formId = answerMatch?.[1] ?? skipMatch?.[1] ?? ''
  const aborted = skipMatch !== null

  let payload: unknown
  try {
    payload = JSON.parse(text.slice(newline + 1))
  } catch {
    return null
  }
  if (!isRecord(payload)) return null
  if (payload.aborted !== aborted) return null

  if (aborted) {
    return {
      formId,
      aborted: true,
      freeText: typeof payload.freeText === 'string' ? payload.freeText : ''
    }
  }
  const answers: Record<string, string> = {}
  if (isRecord(payload.answers)) {
    for (const [key, value] of Object.entries(payload.answers)) {
      if (typeof value === 'string') answers[key] = value
    }
  }
  return { formId, aborted: false, answers }
}
