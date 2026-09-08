# 阶段 2.5 视觉环境物化兜底工序

阶段 2.5 是 profile 驱动的 slot；profile 有规定走 profile。本篇只在**无 active
profile 或 profile 无 Hero treatment 节**时适用——按下方兜底工序执行。

## 何时进入本篇

- system prompt 里没有注入 profile 内容（无 active profile），或
- active profile 没有 `Hero treatment` 节，或
- 用户明确说「本设计走通用兜底，不要 profile 风格」。

任一满足 → 进入本兜底；**其余一律走 profile recipe，不读本篇**。

## 兜底工序

骨架已在阶段 2 立好的语境下走：

1. **HeroContent 渲染**——在骨架 hero 槽 render 标题版式（真文案、真字号；lockup
   默认 lower-third、高度 = W、无眉题）。命名约定 `HeroContent`，便于下游
   `prepare_hero_scaffold` 引用。
2. **prepare_hero_scaffold 调用**——`{ root_id, source_node_id: HeroContent.id, underlap_px: 100, transition_zone_px: 100 }`，underlap / transition_zone 按 W 缩放；返回几何记录（`scaffold_id` / `width` / `height` / `underlap_px` / `transition_zone_px`）下游**只读不散传**——详 `coordinates.md` 字段表。
3. **generate_image 单请求**——`replace_id = scaffold_id`、`references` 传 scaffold
   作合成参照、`width` / `height` 用返回的画幅。prompt 按 CP1 锁定方向自拟，
   三段拼装：风格定调 + 参照用法（围绕标题构图、标题区平静低细节、画面中不画
   文字）+ 文字禁令。详 `hero-prompt-template.md`。
4. **compose_backdrop（阶段 3 末尾）**——根框高度稳定后 `compose_backdrop({ root_id, scaffold_id })`，缺省自动采样，不传 `hero_color`。外部 hero 图源（用户上传、无 scaffold）改用 `compose_backdrop({ root_id, hero_image_from })`。
5. **look 验收**——hero 底部无可见接缝、标题区可读。失败按下方恢复路径走；超 2 轮仍未通过 → 在结论区登记，重生 hero 图计入正文「脱困阀」节整批重生纪律。

## 跳过条件

仅当 brief 明确「纯文字长图」（无图、无 hero、无视觉环境）时跳过本阶段 2.5
**并在结论区显式声明**。其他情况一律走完 5 步。

## 失败恢复路径

| 失败模式                     | 恢复动作                                                    | 升级                                                                     |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| 标题版式压到画面主体         | 重生 hero，prompt 强化「围绕标题构图」「标题区无主体」      | 同批 2 次仍压 → 换 stock_photo / 用户素材路线                            |
| 接缝可见                     | `compose_backdrop` 幂等重调（`canvas_height` 缺省跟随根高） | 重调 2 次仍可见 → 显式传 `hero_color`（按方向色域定）                    |
| 标题区可读性差（深字压深图） | 重生 hero，配出浅色平静带                                   | 同批 2 次仍差 → 加 scrim（workflow 兜底允许；profile 禁时按 profile 走） |
| 风格漂出 CP1 锁定            | 重生，风格词首句重述 CP1 方向                               | 2 次仍漂 → 结论区声明方向被否，回到 CP1 重提案                           |
| 用户整批拒绝                 | 整批重生 ×2 仍未选中 → 走正文「脱困阀」节                   | 强制回 CP1                                                               |

## 兜底纪律（沿用正文「recipe 命名了不存在的 helper 按意图用 render 兜底」）

- profile 缺席处的 agent 自行发挥（风格选择 / 参照用法）写一行结论区备查。
- recipe 命名了工具列表中不存在的 helper → 不发明调用，按意图用 `render` 兜底。
- 「跳步 = 显式失败」——不能省 5 步中任一步而不声明。
- 「不发明几何」——所有几何值用 `prepare_hero_scaffold` 返回或显式 `calc`，不心算、不估。
- 「不发明调用」——不调 recipe / 正文未列的工具。

## 反模式

- profile 已有 Hero treatment 节却走本兜底——以 profile 为准。
- 跳过 look 验收——`compose_backdrop` 幂等重调靠 look 触发。
- 把 5 步合并到阶段 3——视觉物化必须在结构确认后做，结构不稳就铺视觉 = 双倍返工。
- 重生 hero 时不重置 scaffold 几何——同参重调 `compose_backdrop` 即可，重生则 `prepare_hero_scaffold` 也要回到新图。
