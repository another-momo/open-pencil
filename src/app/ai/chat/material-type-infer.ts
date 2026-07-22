/**
 * Local keyword pre-inference for the marketing type chips.
 *
 * Instant, deterministic matching as the user types — the highlighted chip
 * is a visual hint only (source: 'inferred'); the AI's own inference and
 * the user's explicit click take priority. Keyword order matters: more
 * specific keywords should win over generic ones.
 */

const TYPE_KEYWORDS: Record<string, string[]> = {
  xiaohongshu: ['小红书'],
  wechat_moments: ['朋友圈'],
  wechat_article_cover: ['公众号', '封面'],
  ecommerce_detail: ['详情页', '电商'],
  product_long: ['产品长图', '长图'],
  event_poster: ['海报'],
  dsp_banner: ['dsp', 'banner', '横幅', '信息流']
}

/** First match wins; returns the material type id or null */
export function inferMaterialTypeFromText(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [id, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return id
  }
  return null
}
