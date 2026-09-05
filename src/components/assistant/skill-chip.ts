/**
 * T91p：skill chip（钉头单例内联芯片）的前端纯函数面。
 *
 * owner 决议：skill 与画布选区 token 机制本质不同——选区是引用（任意位置、
 * 多实例），skill 是命令（恒钉消息最前、全消息最多一个、新选覆盖旧选）。
 * 因此 chip 是组件状态（ChatInput pinnedSkill），不进 textarea 文本流
 * （文本态 token 可被光标进入逐字编辑，owner 实测观感怪异）；提交时
 * compose 拼到消息头，失败回填时 extract 拆回 chip 状态。
 * skill 名字符集与 pi SDK 命名约定对齐（[A-Za-z0-9_-]+）。
 */

const LEADING_SKILL_COMMAND = /^\/skill:([A-Za-z0-9_-]+)(?:\s+)?/

/**
 * 提交拼装：有 chip → `/skill:<name>` 单空格连正文（正文空则纯命令，
 * 对应 SDK spaceIndex=-1 路径）；无 chip → 原文。
 * 名后单空格是 SDK `_expandSkillCommand` 的识别边界（名取到首个空格止）。
 */
export function composeSkillSubmission(skill: string | null, body: string): string {
  if (!skill) return body
  return body ? `/skill:${skill} ${body}` : `/skill:${skill}`
}

/**
 * 回填拆解：提交文本以 `/skill:<name>` 开头 → 拆出 chip 名 + 剩余正文
 * （名后贴正文无空格也拆——字符集边界即名边界）；否则 null。
 */
export function extractLeadingSkillCommand(text: string): { name: string; rest: string } | null {
  const match = LEADING_SKILL_COMMAND.exec(text)
  if (!match) return null
  return { name: match[1], rest: text.slice(match[0].length) }
}
