/**
 * 画布文案外置（T52，S3 §9 i18n 行：画布对象/工具文案外置，zh-cn 为内容语言——
 * 外置≠英文化）。brief 三件套写到画布上的全部中文展示文案集中在这里；
 * 结构性节点名（寻址用，如 '需求内容' / 'MaterialGrid' / '图片位'）不属于展示文案，
 * 留在 brief.ts 作为常量。
 */
export const BRIEF_TEXTS = {
  /** brief 根 frame 显示名 */
  briefName: '需求单',
  subtitle: '填好后对 AI 说：按需求单做一张朋友圈广告',
  /** 头部绑定行初始文案（未绑定态） */
  bindingUnbound: '关联：（未绑定）',
  /** 头部绑定行前缀，绑定后为 `关联：<设计名> · <页名>` */
  bindingPrefix: '关联：',

  contentZoneName: '内容区',
  contentZoneBadge: '支持长文本 · 双击替换示例',
  contentExample:
    '例如：「XX奶茶」夏季新品买一送一，主推芒果冰沙，单价 9.9 元，活动时间 6 月 1 日 — 6 月 7 日。文案方向：年轻、清爽、突出「夏日解暑」的感觉。',
  fieldsHint: '需要的字段：品牌名 · 优惠活动 · 价格 · 时间 · 想要的文案',

  materialsZoneName: '素材区',
  materialsZoneBadge: '在需求单面板中添加',
  materialsEmptyHint: '暂无素材 · 在需求单面板中添加',
  materialNote: '每张图可备注用途（主视觉 / 卡片配图 / 仅参考风格）',

  conclusionsZoneName: 'AI结论区',
  conclusionsHint: 'AI 确认的结论会记在这里，不用管',
  conclusionsEmptyStatus: '（尚无结论）',

  designsZoneName: '关联设计区',
  designsZoneBadge: '新建设计后自动登记',
  designsEmptyHint: '暂无关联设计 · 新建设计后自动登记',

  /** tombstone 标注：关联设计已删除时追加在条目名后（保痕，不物理清除） */
  deletedMark: '（已删除）',
  /** 关联设计区投影缺省显示（设计身份四元组由 T53 写入，此前无数据可投影） */
  missingProjection: '—'
} as const
