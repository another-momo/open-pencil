/**
 * T91o：normalizeSkillCommandText 纯函数钉扎——首个 /skill: 提及提到消息头 +
 * 单空格连正文（SDK「开头 + 空格收尾」单命令契约的宿主侧整形）；无提及
 * 原文不动；幂等；其余提及保留字面文本。
 */

import { expect, test } from 'bun:test'

import { normalizeSkillCommandText } from '@/app/ai/pi-backend/skill-command'

test('T91o owner 情况①：名后直接贴中文（无空格）→ 命令形 + 正文作 args', () => {
  expect(normalizeSkillCommandText('/skill:yingzao使用这个技能生成一张小猫图片')).toBe(
    '/skill:yingzao 使用这个技能生成一张小猫图片'
  )
})

test('T91o owner 情况②：句尾/句中提及 → 提到消息头', () => {
  expect(normalizeSkillCommandText('生成一只小猫图片 /skill:pixel-style-poster-skill')).toBe(
    '/skill:pixel-style-poster-skill 生成一只小猫图片'
  )
  // 句中紧贴提及移除后接缝收敛为单空格
  expect(normalizeSkillCommandText('用/skill:demo这个技能画图')).toBe('/skill:demo 用 这个技能画图')
})

test('T91o 仅命令无正文 → 纯命令（SDK spaceIndex=-1 路径）', () => {
  expect(normalizeSkillCommandText('/skill:demo')).toBe('/skill:demo')
})

test('T91o 已是命令形 → 幂等', () => {
  expect(normalizeSkillCommandText('/skill:demo 画图')).toBe('/skill:demo 画图')
})

test('T91o 多提及：首个提头，其余保留字面文本（SDK 单命令契约）', () => {
  expect(normalizeSkillCommandText('/skill:a 和 /skill:b 各出一张')).toBe(
    '/skill:a 和 /skill:b 各出一张'
  )
  expect(normalizeSkillCommandText('用 /skill:a 和 /skill:b 各出一张')).toBe(
    '/skill:a 用 和 /skill:b 各出一张'
  )
})

test('T91o 无 /skill: 提及 → 原文不动', () => {
  expect(normalizeSkillCommandText('普通消息')).toBe('普通消息')
  expect(normalizeSkillCommandText('')).toBe('')
})
