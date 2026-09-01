/**
 * setup_design ToolDef（T53，S3 §2）：仅「新建」营销设计时调用。
 *
 * catalog / confirmedNewIntent 不走 schema（不进模型视野），由宿主随 args
 * 外层注入：__catalog = SetupCatalog 的 JSON 串、__confirmedNewIntent =
 * 'true' 字符串（T22 document_id 注入同缝；pi-backend 侧接线属集成期主
 * agent 领土）。本 wrapper 只做提取与类型转置，不把注入缝参数名写进任何
 * 用户可见文案。MCP/headless 无注入：仅 modeId='general' 且不带
 * profileId 可用，其余返回 catalog_unavailable 结构化错误。
 */

import { defineTool, type ToolDef } from '#core/tools/schema'

import { setupDesign, type SetupCatalog } from './setup'

/** 宿主注入的 catalog JSON 串 → 快照对象；解析失败按未注入处理（宿主 bug 不炸画布） */
function parseInjectedCatalog(raw: unknown): SetupCatalog | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  try {
    return JSON.parse(raw) as SetupCatalog
  } catch {
    return undefined
  }
}

export const setupDesignTool = defineTool({
  name: 'setup_design',
  mutates: true,
  description:
    'Create a NEW marketing design root frame for the given mode and register it in the 关联设计区 of the 需求单 (design brief) it serves. Call this ONLY when the user wants a new design — the host must confirm the new-design intent out-of-band first; without that confirmation the call returns { error: "unconfirmed_new_intent" } and nothing is created (ask the user whether they want a new design, then retry). There is no adopt/continue here: repeat calls always create another frame (named "<label> 2", "3", ...). Canvas size: each mode may declare size presets in the host catalog (modes[].sizes — pick the preset whose label matches the user intent, e.g. 小红书长图), overridable via the canvas param; with neither, the default is 750-wide with HUG height (grows with content). Height null in the result means HUG. Placement is automatic (right of existing page content) and the viewport scrolls to the new frame.',
  params: {
    modeId: {
      type: 'string',
      required: true,
      description:
        'Design mode id — "general" for the plain long-image canvas (always valid), or a mode id from the host studio catalog.'
    },
    profileId: {
      type: 'string',
      description: 'Style profile id from the host studio catalog (optional).'
    },
    briefId: {
      type: 'string',
      required: true,
      description:
        'Id of the 需求单 (design brief) this design serves — the new design is bound to it and registered in its 关联设计区.'
    },
    canvas: {
      type: 'string',
      description:
        'Canvas size override (optional) — a canvas value from the mode\'s sizes presets in the host catalog, or a free value: "<width>x" (height grows with content) or "<width>x<height>" (fixed height), e.g. "750x" / "750x2000". Invalid format returns { error: "invalid_canvas" } and nothing is created. Omit to use the mode\'s first preset, or the 750-wide HUG default when the mode has no presets.'
    }
  },
  execute: (figma, args) => {
    const injected: Record<string, unknown> = args
    return setupDesign(
      figma,
      {
        modeId: args.modeId,
        profileId: args.profileId,
        briefId: args.briefId,
        canvas: args.canvas,
        confirmedNewIntent: injected.__confirmedNewIntent === 'true'
      },
      parseInjectedCatalog(injected.__catalog)
    )
  }
})

/** 集成纪律：FORK_TOOLS / pi-backend 暴露面由主 agent 统一接线，本数组是唯一交付面 */
export const SETUP_TOOLS: ToolDef[] = [setupDesignTool]
