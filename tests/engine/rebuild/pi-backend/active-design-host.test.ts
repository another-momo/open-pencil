/**
 * T60（Phase 3 W3/T-B9）active_design 宿主路由契约测试——pi-backend 侧。
 *
 * 验收映射（T60-plan §3 宿主侧；桥 IO 全注入假件，不触真桥）：
 *  - 组装：空槽（含桥不可达降级）/ 有槽 / 落盘 mode 缺失 / profile 有无 /
 *    base→workflow→profile 顺序固定；身份封套与系统提示行进 contextLines
 *  - 信封剥离 + 一次性旗标：置真 / finalizeTurn 复位 / 不滞留 / 仅首行命中
 *  - 事件④：formId 映射移槽 / 跳过不移 / 未知 formId（刷新丢失边界）不移 /
 *    节点失格不移；映射记录只认 ask_user_question awaiting 信封
 *  - 删除悬空：清槽（writeSlot('')）+ slotCleared 提示行；brief 悬空提示行
 *  - setup_design 旗标契约（验收标准 2 宿主半）：信封真 → newIntentConfirmed
 *    返真（注入缝 __confirmedNewIntent 的真源），无信封恒假
 */

import { describe, expect, test } from 'bun:test'

import type {
  ActiveDesignSlotState,
  DesignRootSnapshot
} from '@open-pencil/core/tools/fork/marketing/active-design'
import { serializeAskAnswer } from '@open-pencil/core/tools/fork/marketing/ask-user-question'
import { ACTIVE_DESIGN_TEXTS } from '@open-pencil/core/tools/fork/marketing/texts'

import {
  assembleTurn,
  createActiveDesignHost,
  designTargetEnvelope,
  stripNewIntentEnvelope,
  type ActiveDesignBridgeIO,
  type CandidateProbeData,
  type SlotProbeData
} from '@/app/ai/pi-backend/active-design-host'
import type { StudioRegistry, StudioWorkflow } from '@/app/ai/pi-backend/studio/types'

// ── fixture ──────────────────────────────────────────────────────────────────

function makeWorkflow(id: string, body: string): StudioWorkflow {
  return {
    kind: 'workflow',
    id,
    label: id,
    types: 'none',
    body,
    sections: {},
    origin: 'builtin',
    path: `${id}.md`
  }
}

function makeRegistry(): StudioRegistry {
  return {
    base: {
      kind: 'base',
      id: 'base',
      body: 'BASE',
      sections: {},
      origin: 'builtin',
      path: 'base.md'
    },
    workflows: new Map([['longform', makeWorkflow('longform', 'LONGFORM-WORKFLOW')]]),
    profiles: new Map([
      [
        'watercolor',
        {
          kind: 'profile' as const,
          id: 'watercolor',
          label: '水彩',
          applicableTo: ['longform'],
          deprecated: false,
          body: 'PROFILE-BODY',
          sections: {},
          origin: 'builtin' as const,
          path: 'watercolor.md'
        }
      ]
    ]),
    modes: [{ id: 'general', label: '通用设计', source: 'general' }],
    failures: []
  }
}

function designSnap(overrides: Partial<DesignRootSnapshot> = {}): DesignRootSnapshot {
  return {
    nodeId: 'd1',
    name: '长图',
    type: 'FRAME',
    pageId: 'page-1',
    marketingRoot: true,
    modeId: 'longform',
    profileId: 'watercolor',
    briefId: 'b1',
    ...overrides
  }
}

type FakeBridge = ActiveDesignBridgeIO & {
  writes: string[]
  setSlot(slotNodeId: string, design: DesignRootSnapshot | null): void
  setCandidate(nodeId: string, design: DesignRootSnapshot | null): void
}

/** 假桥：内存槽位 + 写记录；probeCandidate 读独立候选表 */
function makeFakeBridge(): FakeBridge {
  let slot: SlotProbeData = {
    slotNodeId: '',
    currentPageId: 'page-1',
    design: null,
    brief: null,
    materialized: false
  }
  const candidateById = new Map<string, DesignRootSnapshot | null>()
  const writes: string[] = []
  return {
    writes,
    setSlot(slotNodeId, design) {
      slot = { ...slot, slotNodeId, design }
      if (design) candidateById.set(design.nodeId, design)
    },
    setCandidate(nodeId, design) {
      candidateById.set(nodeId, design)
    },
    probeSlot: () => Promise.resolve(slot),
    probeCandidate: (nodeId) => {
      const design = candidateById.get(nodeId) ?? null
      const data: CandidateProbeData = {
        currentPageId: slot.currentPageId,
        design,
        brief: null,
        materialized: false
      }
      return Promise.resolve(data)
    },
    writeSlot: (nodeId) => {
      writes.push(nodeId)
      slot = { ...slot, slotNodeId: nodeId }
      return Promise.resolve(true)
    }
  }
}

function makeHost(bridge: ActiveDesignBridgeIO, registry = makeRegistry()) {
  return createActiveDesignHost({ registry: () => registry, bridge })
}

// ── 信封剥离 ─────────────────────────────────────────────────────────────────

describe('新建意图信封剥离', () => {
  test('完整信封（modeId+profileId）→ 剥离 + 双字段', () => {
    const { envelope, stripped } = stripNewIntentEnvelope(
      '[新建意图确认 modeId=longform profileId=watercolor]\n帮我做一张图'
    )
    expect(envelope).toEqual({ modeId: 'longform', profileId: 'watercolor' })
    expect(stripped).toBe('帮我做一张图')
  })

  test('字段可缺省：裸标记 / 仅 modeId', () => {
    expect(stripNewIntentEnvelope('[新建意图确认]\nhi').envelope).toEqual({})
    expect(stripNewIntentEnvelope('[新建意图确认 modeId=general]\nhi').envelope).toEqual({
      modeId: 'general'
    })
  })

  test('仅首行命中：非首行/畸形不剥离', () => {
    const notFirst = stripNewIntentEnvelope('你好\n[新建意图确认 modeId=x]')
    expect(notFirst.envelope).toBeNull()
    expect(notFirst.stripped).toBe('你好\n[新建意图确认 modeId=x]')
    expect(stripNewIntentEnvelope('[新建意图确认 modeId=x\nhi').envelope).toBeNull()
  })

  test('信封即整条消息 → stripped 空串；CRLF 容忍', () => {
    expect(stripNewIntentEnvelope('[新建意图确认 modeId=x]').stripped).toBe('')
    expect(stripNewIntentEnvelope('[新建意图确认 modeId=x]\r\nhi').stripped).toBe('hi')
  })
})

// ── 一次性旗标（验收标准 2 宿主半）────────────────────────────────────────────

describe('新建意图一次性旗标', () => {
  test('信封回合 newIntentConfirmed 返真；finalizeTurn 复位；次回合不滞留', async () => {
    const host = makeHost(makeFakeBridge())
    await host.prepareTurn('[新建意图确认 modeId=longform]\n做图')
    expect(host.newIntentConfirmed()).toBe(true)
    host.finalizeTurn()
    expect(host.newIntentConfirmed()).toBe(false)

    await host.prepareTurn('普通消息')
    expect(host.newIntentConfirmed()).toBe(false)
    host.finalizeTurn()
  })

  test('无信封恒假（setup_design 契约：旗标假时 core 恒拒绝 unconfirmed_new_intent）', async () => {
    const host = makeHost(makeFakeBridge())
    await host.prepareTurn('做一张长图')
    expect(host.newIntentConfirmed()).toBe(false)
    host.finalizeTurn()
  })
})

// ── 每回合组装 ───────────────────────────────────────────────────────────────

describe('每回合组装（assembleTurn）', () => {
  const registry = makeRegistry()

  test('空槽 = base only + 无封套（general + 无 profile）', () => {
    const turn = assembleTurn(registry, { status: 'empty' })
    expect(turn.systemPrompt).toBe('BASE')
    expect(turn.contextLines).toEqual([])
  })

  test('有槽：base → workflow → profile 顺序固定 + 身份封套首行', () => {
    const slot: ActiveDesignSlotState = {
      status: 'ok',
      design: designSnap(),
      briefMissing: false
    }
    const turn = assembleTurn(registry, slot)
    expect(turn.systemPrompt).toBe('BASE\n\nLONGFORM-WORKFLOW\n\nPROFILE-BODY')
    expect(turn.contextLines[0]).toBe(
      '[当前设计目标 nodeId=d1 modeId=longform profileId=watercolor briefId=b1]'
    )
  })

  test('general mode：无 workflow 段；profile 选中仍注入', () => {
    const turn = assembleTurn(registry, {
      status: 'ok',
      design: designSnap({ modeId: 'general' }),
      briefMissing: false
    })
    expect(turn.systemPrompt).toBe('BASE\n\nPROFILE-BODY')
  })

  test('profile 缺省 → 封套省略 profileId 字段且不注入 profile 段', () => {
    const turn = assembleTurn(registry, {
      status: 'ok',
      design: designSnap({ profileId: '' }),
      briefMissing: false
    })
    expect(turn.systemPrompt).toBe('BASE\n\nLONGFORM-WORKFLOW')
    expect(turn.contextLines[0]).toBe('[当前设计目标 nodeId=d1 modeId=longform briefId=b1]')
  })

  test('profileId 未命中注册表 → 跳过（失败面归 manifest failures）', () => {
    const turn = assembleTurn(registry, {
      status: 'ok',
      design: designSnap({ profileId: 'ghost' }),
      briefMissing: false
    })
    expect(turn.systemPrompt).toBe('BASE\n\nLONGFORM-WORKFLOW')
  })

  test('落盘 mode 的 workflow 缺失 → 一行系统提示 + 按 general 组装（封套保留）', () => {
    const turn = assembleTurn(registry, {
      status: 'ok',
      design: designSnap({ modeId: 'ghost-mode' }),
      briefMissing: false
    })
    expect(turn.systemPrompt).toBe('BASE')
    expect(turn.contextLines).toHaveLength(2)
    expect(turn.contextLines[1]).toBe(ACTIVE_DESIGN_TEXTS.workflowMissing('ghost-mode'))
  })

  test('brief 悬空 → 提示行进 contextLines', () => {
    const turn = assembleTurn(registry, {
      status: 'ok',
      design: designSnap(),
      briefMissing: true
    })
    expect(turn.contextLines).toContain(ACTIVE_DESIGN_TEXTS.briefMissing)
  })
})

// ── prepareTurn 管线（桥假件）────────────────────────────────────────────────

describe('prepareTurn 管线', () => {
  test('桥不可达（probeSlot → null）→ 按空槽组装 + 信封照常剥离', async () => {
    const down: ActiveDesignBridgeIO = {
      probeSlot: () => Promise.resolve(null),
      probeCandidate: () => Promise.resolve(null),
      writeSlot: () => Promise.resolve(false)
    }
    const host = makeHost(down)
    const { promptText } = await host.prepareTurn('[新建意图确认 modeId=longform]\n做图')
    expect(promptText).toBe('做图')
    expect(host.newIntentConfirmed()).toBe(true)
    expect(host.turnAssembly()).toEqual({ systemPrompt: 'BASE', contextLines: [] })
    host.finalizeTurn()
  })

  test('槽位悬空 → 清槽（writeSlot 空串）+ slotCleared 提示 + 按空槽组装', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('ghost-node', null) // 槽指针悬空（节点已删）
    const host = makeHost(bridge)
    await host.prepareTurn('继续')
    expect(bridge.writes).toEqual([''])
    const turn = host.turnAssembly()
    expect(turn?.systemPrompt).toBe('BASE')
    expect(turn?.contextLines).toEqual([ACTIVE_DESIGN_TEXTS.slotCleared])
    host.finalizeTurn()
  })

  test('有槽回合：封套 + 系统提示经 turnAssembly 供 before_agent_start 搬运', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('d1', designSnap())
    const host = makeHost(bridge)
    const { promptText } = await host.prepareTurn('继续填充')
    expect(promptText).toBe('继续填充')
    expect(host.turnAssembly()?.systemPrompt).toBe('BASE\n\nLONGFORM-WORKFLOW\n\nPROFILE-BODY')
    host.finalizeTurn()
    expect(host.turnAssembly()).toBeNull()
  })
})

// ── 事件④：表单作答移槽 ──────────────────────────────────────────────────────

describe('事件④：formId 映射移槽', () => {
  const FORM_ID = 'form-test-aaaaaa'

  test('作答信封 → 移槽回发表单 run 所属设计区', async () => {
    const bridge = makeFakeBridge()
    const design = designSnap()
    bridge.setSlot(design.nodeId, design)
    const host = makeHost(bridge)
    await host.prepareTurn('第一阶段') // run 1：槽位 d1
    host.observeToolExecution('ask_user_question', false, {
      formId: FORM_ID,
      status: 'awaiting_user'
    })
    host.finalizeTurn()

    await host.prepareTurn(serializeAskAnswer(FORM_ID, { aborted: false, answers: { q1: 'a' } }))
    expect(bridge.writes).toEqual(['d1'])
    host.finalizeTurn()
  })

  test('作答消息文本不剥离（AI 须读答案）；[表单跳过] 不移槽', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('d1', designSnap())
    const host = makeHost(bridge)
    await host.prepareTurn('第一阶段')
    host.observeToolExecution('ask_user_question', false, {
      formId: FORM_ID,
      status: 'awaiting_user'
    })
    host.finalizeTurn()

    const answerText = serializeAskAnswer(FORM_ID, { aborted: false, answers: { q1: 'a' } })
    const { promptText } = await host.prepareTurn(answerText)
    expect(promptText).toBe(answerText)
    host.finalizeTurn()

    const skipText = serializeAskAnswer(FORM_ID, { aborted: true, freeText: '算了' })
    const writesBefore = bridge.writes.length
    await host.prepareTurn(skipText)
    expect(bridge.writes.length).toBe(writesBefore)
    host.finalizeTurn()
  })

  test('未知 formId（刷新丢映射边界）→ 静默不移槽', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('d1', designSnap())
    const host = makeHost(bridge)
    await host.prepareTurn(serializeAskAnswer('form-gone-zzzzzz', { aborted: false, answers: {} }))
    expect(bridge.writes).toEqual([])
    host.finalizeTurn()
  })

  test('节点失格（已非设计区根框）→ 不移槽', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('d1', designSnap())
    const host = makeHost(bridge)
    await host.prepareTurn('第一阶段')
    host.observeToolExecution('ask_user_question', false, {
      formId: FORM_ID,
      status: 'awaiting_user'
    })
    host.finalizeTurn()

    bridge.setSlot('', null)
    bridge.setCandidate('d1', designSnap({ marketingRoot: false })) // 节点仍在但已非设计区根框
    const writesBefore = bridge.writes.length
    await host.prepareTurn(serializeAskAnswer(FORM_ID, { aborted: false, answers: {} }))
    expect(bridge.writes.length).toBe(writesBefore)
    host.finalizeTurn()
  })

  test('映射登记只认 ask_user_question awaiting 信封（其他工具/错误结果忽略）', async () => {
    const bridge = makeFakeBridge()
    bridge.setSlot('d1', designSnap())
    const host = makeHost(bridge)
    await host.prepareTurn('第一阶段')
    host.observeToolExecution('create_brief', false, { formId: FORM_ID })
    host.observeToolExecution('ask_user_question', true, {
      formId: FORM_ID,
      status: 'awaiting_user'
    })
    host.observeToolExecution('ask_user_question', false, { formId: FORM_ID, status: 'done' })
    host.finalizeTurn()

    await host.prepareTurn(serializeAskAnswer(FORM_ID, { aborted: false, answers: {} }))
    expect(bridge.writes).toEqual([])
    host.finalizeTurn()
  })
})

// ── 事件①：setup_design 成功移槽回调 ────────────────────────────────────────

describe('事件①：onDesignCreated 移槽', () => {
  test('成功 → writeSlot(新 root id)', async () => {
    const bridge = makeFakeBridge()
    const host = makeHost(bridge)
    await host.onDesignCreated('new-root')
    expect(bridge.writes).toEqual(['new-root'])
  })
})

test('designTargetEnvelope：三元组 + 节点 id（profileId 缺省省略）', () => {
  expect(designTargetEnvelope(designSnap())).toBe(
    '[当前设计目标 nodeId=d1 modeId=longform profileId=watercolor briefId=b1]'
  )
  expect(designTargetEnvelope(designSnap({ profileId: '' }))).toBe(
    '[当前设计目标 nodeId=d1 modeId=longform briefId=b1]'
  )
})
