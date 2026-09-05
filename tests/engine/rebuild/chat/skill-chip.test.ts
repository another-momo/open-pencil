/**
 * T91p：skill-chip 纯函数钉扎——compose 提交拼装（chip 钉消息头 + 单空格
 * 连正文）/ extract 回填拆解（开头命令拆回 chip 状态）/ 往返无损。
 */

import { expect, test } from 'bun:test'

import {
  composeSkillSubmission,
  extractLeadingSkillCommand
} from '@/components/assistant/skill-chip'

test('composeSkillSubmission：有 chip + 正文 → 命令形；无正文 → 纯命令；无 chip → 原文', () => {
  expect(composeSkillSubmission('demo', '生成一张小猫图片')).toBe('/skill:demo 生成一张小猫图片')
  expect(composeSkillSubmission('demo', '')).toBe('/skill:demo')
  expect(composeSkillSubmission(null, '普通消息')).toBe('普通消息')
})

test('extractLeadingSkillCommand：开头命令拆出 chip 名 + 剩余正文', () => {
  expect(extractLeadingSkillCommand('/skill:demo 生成一张小猫图片')).toEqual({
    name: 'demo',
    rest: '生成一张小猫图片'
  })
  // 纯命令
  expect(extractLeadingSkillCommand('/skill:demo')).toEqual({ name: 'demo', rest: '' })
  // 名后贴正文无空格也拆（字符集边界即名边界）
  expect(extractLeadingSkillCommand('/skill:yingzao使用这个技能')).toEqual({
    name: 'yingzao',
    rest: '使用这个技能'
  })
  // 非命令开头 → null
  expect(extractLeadingSkillCommand('普通 /skill:demo 提及')).toBeNull()
  expect(extractLeadingSkillCommand('')).toBeNull()
})

test('compose → extract 往返无损', () => {
  const composed = composeSkillSubmission('pixel-style-poster-skill', '生成一只小猫')
  expect(extractLeadingSkillCommand(composed)).toEqual({
    name: 'pixel-style-poster-skill',
    rest: '生成一只小猫'
  })
})
