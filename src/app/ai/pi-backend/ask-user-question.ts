/**
 * T56（Phase 3 W2/T-B5）：AI 可见 ask_user_question 的后端工具工厂——全新建。
 *
 * 语义（S3 §6 + v5 拍板「run 终止续跑」）：AI 调工具发表单 → execute 校验通过
 * → 返回 `{ formId, status: 'awaiting_user', questions }`（content + details 双带），
 * 结果文本含「回合到此结束、等待用户作答」指令（软终止——pi 无硬停机制）；
 * 前端据 tool part input.questions 渲染聊天内表单卡片，用户作答/跳过经
 * 下一条用户消息的文本信封物化（serializeAskAnswer/parseAskAnswer，core 纯函数层）。
 *
 * 装配形态：createAskUserQuestionTool(deps) 工厂返回 pi AgentTool——由主 agent
 * 集成期在 service.ts 装配进 customTools（本任务不改 service.ts）。
 * 无桥调用、无凭证、无落盘——纯定义转发 + 校验。
 */

import { defineTool, type AgentToolResult } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

import {
  makeFormId,
  validateAskUserQuestions,
  type AskQuestionSpec
} from '@open-pencil/core/tools/fork/marketing/ask-user-question'

import { toToolResult } from './tool-result'

const ASK_USER_QUESTION_DESCRIPTION =
  'Present an in-chat form with questions for the user, then END the current turn. The frontend renders a form card (single_select option cards, image_select canvas-node thumbnails, text inputs) and always offers a free-text field that doubles as a fourth answer kind (the user\'s own words, may arrive as an optional "freeText" key on the answer envelope) and as a skip reason. Returns {formId, status:"awaiting_user", questions}: the run TERMINATES with this call — do not call further tools and do not write any more text after it. The user\'s answers will arrive as the next user message. Rules: 1-8 questions; ids unique and non-empty; labels non-empty; single_select needs options (2-12 items, each {id,label,hint?}) and must not carry imageOptions; image_select needs imageOptions (1-12 items, each {nodeId,label?} referencing canvas nodes) and must not carry options; text carries neither; required defaults to true — set false for optional questions. Batch everything you need to ask into ONE call.'

/** awaiting 信封 details 形状（mapping.ts tool-output-available 骑 details 到前端）；
 * type 别名（非 interface）以获得隐式索引签名，免类型断言 */
export type AskAwaitingDetails = {
  formId: string
  status: 'awaiting_user'
  questions: AskQuestionSpec[]
}

export interface AskUserQuestionToolDeps {
  /** formId 源（缺省 makeFormId() 默认源）；测试注入确定性 */
  makeId?: () => string
}

const QUESTION_SCHEMA = Type.Object({
  id: Type.String({ description: 'Unique question id' }),
  kind: Type.Union([
    Type.Literal('single_select'),
    Type.Literal('image_select'),
    Type.Literal('text')
  ]),
  label: Type.String({ description: 'Question text shown to the user', maxLength: 2000 }),
  options: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String(),
        label: Type.String(),
        hint: Type.Optional(Type.String())
      }),
      { description: 'single_select only: 2-12 options' }
    )
  ),
  imageOptions: Type.Optional(
    Type.Array(
      Type.Object({
        nodeId: Type.String({ description: 'Canvas node id to render as thumbnail' }),
        label: Type.Optional(Type.String())
      }),
      { description: 'image_select only: 1-12 canvas-node candidates' }
    )
  ),
  required: Type.Optional(Type.Boolean({ description: 'Default true' }))
})

export function createAskUserQuestionTool(deps: AskUserQuestionToolDeps = {}) {
  return defineTool({
    name: 'ask_user_question',
    label: 'Ask User Question',
    description: ASK_USER_QUESTION_DESCRIPTION,
    parameters: Type.Object({
      questions: Type.Array(QUESTION_SCHEMA, { description: '1-8 form questions' })
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> {
      const validated = validateAskUserQuestions(params)
      if ('error' in validated) {
        return toToolResult({ error: validated.error, message: validated.message })
      }

      const formId = deps.makeId ? deps.makeId() : makeFormId()
      const details: AskAwaitingDetails = {
        formId,
        status: 'awaiting_user',
        questions: validated.questions
      }
      // Soft-stop instructions (English, model-facing): turn ends here, answers
      // are materialized via the next user message.
      const text = [
        `Form rendered to the user (formId=${formId}, ${details.questions.length} question${details.questions.length === 1 ? '' : 's'}).`,
        'Turn ends here: do not call any more tools and do not write any more text — end this reply immediately.',
        "The user's answer (or skip) will arrive as the next user message; resume from that content.",
        'The answer envelope JSON may include an optional "freeText" field with the user\'s own words — treat it as a first-class answer.'
      ].join('\n')
      return {
        content: [{ type: 'text', text }],
        details
      }
    }
  })
}
