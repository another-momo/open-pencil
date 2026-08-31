/**
 * T54（Phase 3 W2/T-B3）：generate_image 服务商预设表（纯数据，同构——
 * 前端设置面板与后端凭证路由共用；不得引入 node 依赖）。
 *
 * 收敛形态（08 §I）：设置 UI = 预设下拉 + 单 key 输入；baseURL/model 由
 * 预设携带，用户不手填。
 *
 * 默认无第三方中转（08 P0-5b）：DEFAULT_IMAGE_GEN_PRESET_ID = 'openai'
 * （官方端点）；DMX 是可选预设而非默认。未配置凭证时后端无任何隐式
 * baseURL——getActiveCredentials() 返回 null，工具报错引导配置。
 */

export interface ImageGenPreset {
  id: string
  label: string
  baseUrl: string
  model: string
}

export const IMAGE_GEN_PRESETS: readonly ImageGenPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI (gpt-image-1)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-image-1'
  },
  {
    id: 'dmx',
    label: 'DMX API (gpt-image-2)',
    baseUrl: 'https://www.dmxapi.cn/v1',
    model: 'gpt-image-2-ssvip'
  }
] as const

/** 默认预设 = OpenAI 官方端点（默认不指向任何第三方中转，08 P0-5b） */
export const DEFAULT_IMAGE_GEN_PRESET_ID = 'openai'

export function findImageGenPreset(presetId: string): ImageGenPreset | undefined {
  return IMAGE_GEN_PRESETS.find((preset) => preset.id === presetId)
}
