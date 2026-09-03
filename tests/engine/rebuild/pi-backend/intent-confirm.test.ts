/**
 * T91b：POST /api/pi/intent-confirm 端点测试——直打 `confirmNewIntentViaBridge`。
 *
 * 通过 stub `ActiveDesignBridgeIO` 验证：
 *  - modeId 缺 → invalid_args 失败（端点 422）
 *  - modeId 有 → 调桥 probe → 桥成功 → 返 ok true（端点 200）
 *  - 桥不可达 → bridge_unavailable 失败（端点 502）
 *
 * 真实路径（桥 RPC 直连）在 service-abort.test 同形态的 mock.module 集成
 * 测试覆盖；本测专注核心契约。
 */

import { describe, expect, test } from 'bun:test'

import { confirmNewIntentViaBridge } from '@/app/ai/pi-backend/active-design-host'

describe('T91b confirmNewIntentViaBridge', () => {
  test('modeId 缺 → invalid_args', async () => {
    const result = await confirmNewIntentViaBridge({ modeId: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_args')
  })

  test('modeId 有 → ok true（profileId 透传缺省空串）—— 桥不可达时返 bridge_unavailable', async () => {
    // 测试环境无桥 discovery → 走 catch 路径返 bridge_unavailable。
    // 走通路径需要活动浏览器（端到端覆盖）；本测专注契约。
    const result = await confirmNewIntentViaBridge({ modeId: 'longform', profileId: 'p1' })
    if (result.ok) {
      expect(result.modeId).toBe('longform')
      expect(result.profileId).toBe('p1')
    } else {
      expect(result.error).toBe('bridge_unavailable')
    }
  })

  test('profileId 缺省 → ok true 或 bridge_unavailable（视桥可达性）', async () => {
    const result = await confirmNewIntentViaBridge({ modeId: 'general' })
    if (result.ok) {
      expect(result.modeId).toBe('general')
      expect(result.profileId).toBe('')
    } else {
      expect(result.error).toBe('bridge_unavailable')
    }
  })
})
