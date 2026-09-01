/**
 * T53（S4 W2 / T-B2）setup_design 契约测试（S3 §10 九契约改写版 + 三态解析）。
 *
 * 验收映射（T53-plan §3）：
 * ① 蓝图尺寸建框（750 宽）；② HUG/FIXED 语义（'750x' HUG 初始高 400 /
 *   '1080x1080' FIXED）；③ 标记六键读穿（role + 四元组 + schemaVersion）；
 * ④ 最小空闲「label N」命名；⑤ briefId 不存在 → brief_not_found；
 * ⑥ modeId 校验（general 恒过 / unknown_mode / types:'none' mode 过）；
 * ⑦ typeId 三态（在册过 / type_forbidden / type_required / type_not_in_mode）；
 * ⑧ 未确认 → unconfirmed_new_intent 且无框落地；
 * ⑨ 关联设计区登记 + bound-designs 指针 + 读穿投影。
 * 另钉：信封字段、恒新建、放置右 +100/y 跟随、scrollAndZoomIntoView、
 * catalog 缺省仅 general 可用、unknown_profile、__catalog/__confirmedNewIntent
 * 注入缝（ToolDef 层）、scan/resolve 三态（none/ok/ambiguous/显式 id/死节点/
 * 两次扫描独立）。
 *
 * SETUP_TOOLS 未注册进 FORK_TOOLS（fork/index.ts 是集成期主 agent 领土），
 * catalog fixture 直接注入 core 函数（S3 §10 校验断言落 bun 层）。
 */

import { describe, expect, test } from 'bun:test'

import { getSharedPluginData } from '#core/figma-api/plugin-data'
import {
  BRIEF_DESIGN_ENTRY_KEY,
  BRIEF_PLUGIN_NAMESPACE,
  BRIEF_ROLE_KEY,
  BRIEF_SCHEMA_VERSION,
  BRIEF_SCHEMA_VERSION_KEY,
  BRIEF_WIDTH,
  BRIEF_ZONE_DESIGNS,
  DESIGN_BRIEF_KEY,
  DESIGN_MODE_KEY,
  DESIGN_PROFILE_KEY,
  DESIGN_TYPE_KEY,
  briefBoundDesignIds,
  createBrief,
  findBriefZone
} from '#core/tools/fork/marketing/brief'
import { readBrief } from '#core/tools/fork/marketing/brief-edit'
import {
  MARKETING_ROLE_ROOT,
  isMarketingDesignRoot,
  resolveMarketingDesign,
  scanMarketingDesigns,
  setupDesign,
  type SetupCatalog,
  type SetupDesignError,
  type SetupDesignErrorCode,
  type SetupDesignResult,
  type SetupDesignSuccess
} from '#core/tools/fork/marketing/setup'
import { SETUP_TOOLS, setupDesignTool } from '#core/tools/fork/marketing/setup-tool'
import { BRIEF_TEXTS, SETUP_TEXTS } from '#core/tools/fork/marketing/texts'
import { PLACEMENT_GAP } from '#core/tools/fork/placement'

import { expectDefined } from '#tests/helpers/assert'
import { setupToolTest } from '#tests/helpers/tools'

const CATALOG: SetupCatalog = {
  modes: [
    {
      id: 'longform',
      label: '长图',
      types: [
        { id: 'product_long', label: '产品长图', size: '750x' },
        { id: 'square', label: '方图', size: '1080x1080' }
      ]
    },
    { id: 'workflow', label: '工作流', types: 'none' }
  ],
  profileIds: ['profile-a']
}

function ok(result: SetupDesignResult): SetupDesignSuccess {
  if ('error' in result) throw new Error(`unexpected error: ${result.error}`)
  return result
}

function err(result: SetupDesignResult, code: SetupDesignErrorCode): SetupDesignError {
  if (!('error' in result)) throw new Error(`expected error ${code}, got success`)
  expect(result.error).toBe(code)
  expect(result.message).toBeTruthy()
  return result
}

/** 一页一 brief 的标准前置；run 默认带 CATALOG，runWithoutCatalog 走无注入路径 */
function setupPage() {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const call = (
    args: { modeId: string; typeId?: string; profileId?: string },
    catalog: SetupCatalog | undefined
  ) => setupDesign(figma, { briefId: brief.id, confirmedNewIntent: true, ...args }, catalog)
  const run = (args: { modeId: string; typeId?: string; profileId?: string }) => call(args, CATALOG)
  const runWithoutCatalog = (args: { modeId: string; typeId?: string; profileId?: string }) =>
    call(args, undefined)
  return { graph, figma, brief, run, runWithoutCatalog }
}

describe('setup_design core：九契约', () => {
  test('① 蓝图尺寸建框：750 宽 + VERTICAL/counter-FIXED + 白底 + clipsContent', () => {
    const { graph, run } = setupPage()
    const result = ok(run({ modeId: 'longform', typeId: 'product_long' }))

    const root = expectDefined(graph.getNode(result.rootId))
    expect(root.type).toBe('FRAME')
    expect(root.width).toBe(750)
    expect(root.layoutMode).toBe('VERTICAL')
    expect(root.counterAxisSizing).toBe('FIXED')
    expect(root.clipsContent).toBe(true)
    expect(root.fills[0]).toMatchObject({ type: 'SOLID', color: { r: 1, g: 1, b: 1 } })
    expect(result.size).toEqual({ width: 750, height: null })
    expect(result.name).toBe('产品长图')
  })

  test("② HUG/FIXED 语义：'750x' → HUG 初始高 400；'1080x1080' → FIXED 1080", () => {
    const { graph, run } = setupPage()
    const hug = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    const hugRoot = expectDefined(graph.getNode(hug.rootId))
    expect(hugRoot.primaryAxisSizing).toBe('HUG')
    expect(hugRoot.height).toBe(400)

    const fixed = ok(run({ modeId: 'longform', typeId: 'square' }))
    const fixedRoot = expectDefined(graph.getNode(fixed.rootId))
    expect(fixedRoot.primaryAxisSizing).toBe('FIXED')
    expect(fixedRoot.width).toBe(1080)
    expect(fixedRoot.height).toBe(1080)
    expect(fixed.size).toEqual({ width: 1080, height: 1080 })
  })

  test('③ 标记六键读穿：role + 四元组 + schemaVersion（general 缺省键不写）', () => {
    const { graph, brief, run } = setupPage()
    const result = ok(run({ modeId: 'longform', typeId: 'product_long', profileId: 'profile-a' }))
    const root = expectDefined(graph.getNode(result.rootId))

    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, BRIEF_ROLE_KEY)).toBe(
      MARKETING_ROLE_ROOT
    )
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, DESIGN_MODE_KEY)).toBe('longform')
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, DESIGN_TYPE_KEY)).toBe('product_long')
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, DESIGN_PROFILE_KEY)).toBe('profile-a')
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, DESIGN_BRIEF_KEY)).toBe(brief.id)
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, BRIEF_SCHEMA_VERSION_KEY)).toBe(
      BRIEF_SCHEMA_VERSION
    )
    expect(BRIEF_SCHEMA_VERSION).toBe('1')
    expect(isMarketingDesignRoot(root)).toBe(true)

    // general 无 typeId/profileId：缺省键不落盘（读穿为 ''）
    const general = ok(run({ modeId: 'general' }))
    const generalRoot = expectDefined(graph.getNode(general.rootId))
    expect(getSharedPluginData(generalRoot, BRIEF_PLUGIN_NAMESPACE, DESIGN_TYPE_KEY)).toBe('')
    expect(getSharedPluginData(generalRoot, BRIEF_PLUGIN_NAMESPACE, DESIGN_PROFILE_KEY)).toBe('')
  })

  test('④ 最小空闲「label N」命名 + 恒新建：同参数再调得「产品长图 2」', () => {
    const { graph, run } = setupPage()
    const first = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    const second = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    const third = ok(run({ modeId: 'longform', typeId: 'product_long' }))

    // 恒新建：无领养无幂等，三调三根
    expect(second.rootId).not.toBe(first.rootId)
    expect(third.rootId).not.toBe(second.rootId)
    expect(first.name).toBe('产品长图')
    expect(second.name).toBe('产品长图 2')
    expect(third.name).toBe('产品长图 3')

    // 最小空闲：改掉裸名后新建回到「产品长图」
    graph.updateNode(first.rootId, { name: '已改名' })
    const fourth = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    expect(fourth.name).toBe('产品长图')
  })

  test('⑤ briefId 不存在 → brief_not_found；空 briefId 多 brief → ambiguous_brief', () => {
    const { figma } = setupToolTest()
    createBrief(figma)
    const missing = setupDesign(figma, {
      modeId: 'general',
      briefId: 'nonexistent',
      confirmedNewIntent: true
    })
    err(missing, 'brief_not_found')
    expect(scanMarketingDesigns(figma)).toEqual([])

    // 文档无 brief（briefId 空 → none 态）
    const empty = setupToolTest()
    err(
      setupDesign(empty.figma, { modeId: 'general', briefId: '', confirmedNewIntent: true }),
      'brief_not_found'
    )

    // 多 brief 无定位依据 → 歧义信号（比照 findBrief 三态）
    const two = setupToolTest()
    createBrief(two.figma)
    createBrief(two.figma)
    const ambiguous = setupDesign(two.figma, {
      modeId: 'general',
      briefId: '',
      confirmedNewIntent: true
    })
    const failure = err(ambiguous, 'ambiguous_brief')
    expect(failure.candidates?.length).toBe(2)
  })

  test('⑥ modeId 校验：general 恒过 / 未知 → unknown_mode / types:none 的 mode 过', () => {
    const { graph, run } = setupPage()

    const general = ok(run({ modeId: 'general' }))
    const generalRoot = expectDefined(graph.getNode(general.rootId))
    expect(generalRoot.width).toBe(750)
    expect(generalRoot.primaryAxisSizing).toBe('HUG')
    expect(general.name).toBe(SETUP_TEXTS.generalDesignName)

    err(run({ modeId: 'nope' }), 'unknown_mode')

    const workflow = ok(run({ modeId: 'workflow' }))
    expect(workflow.name).toBe('工作流')
    expect(workflow.size).toEqual({ width: 750, height: null })
    const workflowRoot = expectDefined(graph.getNode(workflow.rootId))
    expect(getSharedPluginData(workflowRoot, BRIEF_PLUGIN_NAMESPACE, DESIGN_MODE_KEY)).toBe(
      'workflow'
    )
  })

  test("⑦ typeId 三态：在册过 / types:'none' 传 → type_forbidden / 缺 → type_required / 列表外 → type_not_in_mode", () => {
    const { run } = setupPage()

    expect('error' in run({ modeId: 'longform', typeId: 'product_long' })).toBe(false)

    const forbidden = err(run({ modeId: 'workflow', typeId: 'product_long' }), 'type_forbidden')
    expect(forbidden.modeId).toBe('workflow')

    const required = err(run({ modeId: 'longform' }), 'type_required')
    expect(required.types).toEqual(['product_long', 'square'])

    err(run({ modeId: 'longform', typeId: 'nope' }), 'type_not_in_mode')

    // general 同样不得传 typeId
    err(run({ modeId: 'general', typeId: 'product_long' }), 'type_forbidden')
  })

  test('⑧ 未确认 → unconfirmed_new_intent 且无框落地', () => {
    const { graph, figma, brief } = setupPage()
    const before = expectDefined(graph.getNode(figma.currentPage.id)).childIds.length

    err(
      setupDesign(
        figma,
        { modeId: 'longform', typeId: 'product_long', briefId: brief.id },
        CATALOG
      ),
      'unconfirmed_new_intent'
    )
    err(
      setupDesign(
        figma,
        { modeId: 'general', briefId: brief.id, confirmedNewIntent: false },
        CATALOG
      ),
      'unconfirmed_new_intent'
    )
    expect(expectDefined(graph.getNode(figma.currentPage.id)).childIds.length).toBe(before)
    expect(scanMarketingDesigns(figma)).toEqual([])
  })

  test('⑨ 关联设计区登记：条目 designId + 名称投影 + bound-designs 指针 + 绑定行 + 读穿四元组', () => {
    const { graph, figma, brief, run } = setupPage()
    const result = ok(run({ modeId: 'longform', typeId: 'product_long' }))

    // brief bound-designs 含新根
    const freshBrief = expectDefined(graph.getNode(brief.id))
    expect(briefBoundDesignIds(freshBrief)).toContain(result.rootId)

    // 关联设计区条目：designId 标记权威 + 名称投影
    const zone = expectDefined(findBriefZone(graph, freshBrief, BRIEF_ZONE_DESIGNS))
    const listId = expectDefined(
      zone.childIds.find((id) => graph.getNode(id)?.name === 'DesignList')
    )
    const entryId = expectDefined(expectDefined(graph.getNode(listId)).childIds[0])
    const entry = expectDefined(graph.getNode(entryId))
    expect(getSharedPluginData(entry, BRIEF_PLUGIN_NAMESPACE, BRIEF_DESIGN_ENTRY_KEY)).toBe(
      result.rootId
    )
    const entryText = entry.childIds
      .map((id) => graph.getNode(id))
      .find((node) => node?.type === 'TEXT')
    expect(entryText?.text).toBe('产品长图')

    // 可见绑定行重写为「关联：<设计名> · <页名>」
    const stack = [brief.id]
    const texts: string[] = []
    while (stack.length > 0) {
      const id = expectDefined(stack.pop())
      const node = expectDefined(graph.getNode(id))
      if (node.type === 'TEXT') texts.push(node.text)
      stack.push(...node.childIds)
    }
    expect(texts).toContain(`${BRIEF_TEXTS.bindingPrefix}产品长图 · Page 1`)

    // 读穿投影：read_brief 视图的 modeId/typeId 来自设计根标记
    const view = expectDefined(readBrief(figma))
    expect(view.designs).toEqual([
      {
        entryId,
        designId: result.rootId,
        name: '产品长图',
        modeId: 'longform',
        typeId: 'product_long',
        deleted: false,
        registered: true
      }
    ])
  })

  test('信封字段：成功全字段（含 placement）；general 缺省键不出现', () => {
    const { brief, run } = setupPage()
    const full = ok(run({ modeId: 'longform', typeId: 'product_long', profileId: 'profile-a' }))
    expect(full).toEqual({
      rootId: full.rootId,
      name: '产品长图',
      size: { width: 750, height: null },
      modeId: 'longform',
      typeId: 'product_long',
      profileId: 'profile-a',
      briefId: brief.id,
      placement: { x: BRIEF_WIDTH + PLACEMENT_GAP, y: 0 }
    })

    const general = ok(run({ modeId: 'general' }))
    expect('typeId' in general).toBe(false)
    expect('profileId' in general).toBe(false)
    expect(general.briefId).toBe(brief.id)
  })

  test('放置：页面内容右侧 +100，y 跟随 bounds 顶', () => {
    const { graph, figma, brief, run } = setupPage()
    // 既有内容把 bounds 顶抬到 -500（brief 在 (0,0)，宽 1252）
    graph.createNode('FRAME', figma.currentPage.id, { x: 0, y: -500, width: 100, height: 100 })

    const result = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    expect(result.placement).toEqual({ x: BRIEF_WIDTH + PLACEMENT_GAP, y: -500 })
    const root = expectDefined(graph.getNode(result.rootId))
    expect(root.x).toBe(BRIEF_WIDTH + PLACEMENT_GAP)
    expect(root.y).toBe(-500)
    expect(brief.id).not.toBe(result.rootId)
  })

  test('创建后 scrollAndZoomIntoView：viewport 中心移到新根包围盒中心', () => {
    const { graph, figma, run } = setupPage()
    expect(figma.viewport.center).toEqual({ x: 0, y: 0 })

    const result = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    const root = expectDefined(graph.getNode(result.rootId))
    expect(figma.viewport.center.x).toBe(root.x + root.width / 2)
    expect(figma.viewport.center.y).toBe(root.y + root.height / 2)
    expect(figma.viewport.zoom).toBeLessThanOrEqual(1)
    expect(figma.viewport.zoom).toBeGreaterThan(0)
  })

  test('catalog 缺省：仅 general（无 typeId/profileId）可用，否则 catalog_unavailable', () => {
    const { runWithoutCatalog } = setupPage()

    const general = ok(runWithoutCatalog({ modeId: 'general' }))
    expect(general.size).toEqual({ width: 750, height: null })

    err(runWithoutCatalog({ modeId: 'longform', typeId: 'product_long' }), 'catalog_unavailable')
    err(runWithoutCatalog({ modeId: 'general', profileId: 'profile-a' }), 'catalog_unavailable')
  })

  test('profileId 不在册 → unknown_profile', () => {
    const { run } = setupPage()
    const failure = err(
      run({ modeId: 'longform', typeId: 'product_long', profileId: 'nope' }),
      'unknown_profile'
    )
    expect(failure.profileId).toBe('nope')
  })
})

describe('scanMarketingDesigns / resolveMarketingDesign 无状态三态', () => {
  test('空页 → scan 空 + resolve none；brief/普通 frame 不被误认', () => {
    const { graph, figma } = setupToolTest()
    createBrief(figma)
    graph.createNode('FRAME', figma.currentPage.id, { name: '产品长图' })

    expect(scanMarketingDesigns(figma)).toEqual([])
    expect(resolveMarketingDesign(figma).status).toBe('none')
  })

  test('唯一设计 → resolve ok；scan 读穿四元组 + 名称', () => {
    const { figma, brief, run } = setupPage()
    const created = ok(run({ modeId: 'longform', typeId: 'product_long', profileId: 'profile-a' }))

    const designs = scanMarketingDesigns(figma)
    expect(designs).toEqual([
      {
        rootId: created.rootId,
        name: '产品长图',
        modeId: 'longform',
        typeId: 'product_long',
        profileId: 'profile-a',
        briefId: brief.id
      }
    ])

    const resolved = resolveMarketingDesign(figma)
    expect(resolved.status === 'ok' && resolved.design.rootId).toBe(created.rootId)
    const explicit = resolveMarketingDesign(figma, created.rootId)
    expect(explicit.status === 'ok' && explicit.design.rootId).toBe(created.rootId)
  })

  test('两个设计 → resolve ambiguous（candidates 含四元组投影）；显式 id 命中', () => {
    const { figma, run } = setupPage()
    const first = ok(run({ modeId: 'longform', typeId: 'product_long' }))
    const second = ok(run({ modeId: 'general' }))

    const ambiguous = resolveMarketingDesign(figma)
    expect(ambiguous.status).toBe('ambiguous')
    const candidates = ambiguous.status === 'ambiguous' ? ambiguous.candidates : []
    expect(candidates.length).toBe(2)
    const byId = new Map(candidates.map((candidate) => [candidate.rootId, candidate]))
    expect(byId.get(first.rootId)).toMatchObject({
      name: '产品长图',
      modeId: 'longform',
      typeId: 'product_long'
    })
    expect(byId.get(second.rootId)).toMatchObject({
      name: SETUP_TEXTS.generalDesignName,
      modeId: 'general',
      typeId: ''
    })

    const explicit = resolveMarketingDesign(figma, second.rootId)
    expect(explicit.status === 'ok' && explicit.design.rootId).toBe(second.rootId)
  })

  test('显式 id 未中 → not-found（不存在节点 / 非设计根 frame）', () => {
    const { graph, figma, run } = setupPage()
    ok(run({ modeId: 'general' }))
    const plain = graph.createNode('FRAME', figma.currentPage.id, { name: '普通' })

    expect(resolveMarketingDesign(figma, 'nonexistent')).toEqual({
      status: 'not-found',
      rootId: 'nonexistent'
    })
    expect(resolveMarketingDesign(figma, plain.id)).toEqual({
      status: 'not-found',
      rootId: plain.id
    })
  })

  test('死节点不出现：删除设计根后 scan 为空 + resolve none', () => {
    const { graph, figma, run } = setupPage()
    const created = ok(run({ modeId: 'general' }))
    expect(scanMarketingDesigns(figma).length).toBe(1)

    graph.deleteNode(created.rootId)
    expect(scanMarketingDesigns(figma)).toEqual([])
    expect(resolveMarketingDesign(figma).status).toBe('none')
    expect(resolveMarketingDesign(figma, created.rootId)).toEqual({
      status: 'not-found',
      rootId: created.rootId
    })
  })

  test('两次扫描独立：无进程态，图面变化即时反映', () => {
    const { figma, run } = setupPage()
    ok(run({ modeId: 'general' }))

    const first = scanMarketingDesigns(figma)
    expect(first.length).toBe(1)

    const second = ok(run({ modeId: 'general' }))
    const secondScan = scanMarketingDesigns(figma)
    expect(secondScan).not.toBe(first)
    expect(secondScan.length).toBe(2)
    expect(secondScan.map((design) => design.rootId)).toContain(second.rootId)
  })
})

describe('setup_design ToolDef：schema 与注入缝', () => {
  test('SETUP_TOOLS 交付面 + mutates 钉扎 + schema 仅四参数', () => {
    expect(SETUP_TOOLS).toEqual([setupDesignTool])
    expect(setupDesignTool.name).toBe('setup_design')
    expect(setupDesignTool.mutates).toBe(true)
    expect(Object.keys(setupDesignTool.params)).toEqual([
      'modeId',
      'typeId',
      'profileId',
      'briefId'
    ])
    expect(setupDesignTool.params.modeId?.required).toBe(true)
    expect(setupDesignTool.params.briefId?.required).toBe(true)
  })

  test('__catalog JSON + __confirmedNewIntent=true 注入 → 建框成功', () => {
    const { graph, figma } = setupToolTest()
    const brief = createBrief(figma)

    const result = setupDesignTool.execute(figma, {
      modeId: 'longform',
      typeId: 'product_long',
      briefId: brief.id,
      __catalog: JSON.stringify(CATALOG),
      __confirmedNewIntent: 'true'
    }) as SetupDesignResult
    const success = ok(result)
    const root = expectDefined(graph.getNode(success.rootId))
    expect(getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, DESIGN_TYPE_KEY)).toBe('product_long')
  })

  test('无 __confirmedNewIntent → unconfirmed_new_intent（T-B10 落地前 AI 恒表现）', () => {
    const { graph, figma } = setupToolTest()
    const brief = createBrief(figma)
    const before = expectDefined(graph.getNode(figma.currentPage.id)).childIds.length

    const result = setupDesignTool.execute(figma, {
      modeId: 'general',
      briefId: brief.id,
      __catalog: JSON.stringify(CATALOG)
    }) as SetupDesignResult
    err(result, 'unconfirmed_new_intent')
    expect(expectDefined(graph.getNode(figma.currentPage.id)).childIds.length).toBe(before)
  })

  test('无 __catalog：general 可用、非 general catalog_unavailable；畸形 JSON 按未注入', () => {
    const { figma } = setupToolTest()
    const brief = createBrief(figma)

    const general = setupDesignTool.execute(figma, {
      modeId: 'general',
      briefId: brief.id,
      __confirmedNewIntent: 'true'
    }) as SetupDesignResult
    expect('error' in general).toBe(false)

    const noCatalog = setupDesignTool.execute(figma, {
      modeId: 'longform',
      typeId: 'product_long',
      briefId: brief.id,
      __confirmedNewIntent: 'true'
    }) as SetupDesignResult
    err(noCatalog, 'catalog_unavailable')

    const malformed = setupDesignTool.execute(figma, {
      modeId: 'longform',
      typeId: 'product_long',
      briefId: brief.id,
      __catalog: '{not json',
      __confirmedNewIntent: 'true'
    }) as SetupDesignResult
    err(malformed, 'catalog_unavailable')
  })
})
