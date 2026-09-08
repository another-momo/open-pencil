# profile 协同查找表

阶段 2 / 阶段 3 涉及「按 profile 走还是按 workflow 兜底」的选择之前读本篇。
正文「profile 协同（三档）」节已点过口径；本篇给具体字段名与缺省值，
按字段查「profile 有 / 无 / 缺 active profile」三档各该读哪段。

## 适用对象

- 当前内置 profile 为水彩组（`watercolor_poster_v2` / `watercolor_poster_v2_zh`），对 `longform-hero-kv-first` 与 `longform-structure-first` 都生效；注册集有新增时以 system prompt 实际注入的 profile 为准。
- 无 active profile 时走本表兜底列。

## 字段查找表

| 字段                                     | profile 章节                                                 | profile 缺省                                                 | workflow 兜底（无 profile / profile 无规定） | 优先序             |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------- | ------------------ |
| HeroContent lockup                       | `Hero treatment` → `hero lockup`                             | `{ lower-third, center-left, upper-float }` 默认 lower-third | lower-third                                  | profile > workflow |
| HeroContent hero 高度                    | `Hero treatment` → `hero height`                             | `W`（range 0.8W–1.2W）                                       | `W`                                          | profile > workflow |
| HeroContent 眉题                         | `Typography` → `eyebrow`                                     | `{ none, one small line above the stack }` 默认 none         | 无眉题                                       | profile > workflow |
| prepare_hero_scaffold underlap_px        | `Hero treatment` → `scaffold parameters`                     | 100 @ W=750（按 W 缩放）                                     | 100（按 W 缩放）                             | profile > workflow |
| prepare_hero_scaffold transition_zone_px | `Hero treatment` → `scaffold parameters`                     | 100 @ W=750；`clamped: true` 表示已 clamp 到 underlap_px     | 100                                          | profile > workflow |
| generate_image 风格规则                  | `Hero treatment` → `Watercolor-style prompt`（或对应风格节） | 由 profile 规定                                              | agent 按 CP1 锁定方向自拟 + 写一行结论区备查 | profile > workflow |
| compose_backdrop 配色                    | `Color` → `palette`                                          | 自动采样（不传 hero_color）                                  | 自动采样（不传 hero_color）                  | profile > workflow |
| 字阶（hero/section/body/caption）        | `Typography`                                                 | profile 的 W 分档（如 750 / 1080）                           | 见正文「字阶规则」节                         | profile > workflow |
| look 验收                                | `Hero treatment` / `Forbidden`                               | profile 规定 success criteria 与禁止                         | hero 底部无可见接缝、标题区可读              | profile > workflow |

## 字段读取动作

- active profile 的全文**已在 system prompt 里**（装配期注入）——直接查对应章节即可，**不需要任何工具调用**。
- `load_reference` 只用于加载本 workflow 的 references 文件（如 `coordinates.md`），不能也不用于读 profile。
- profile 不在 active 集合内（system prompt 无 profile 段）：本表只用于「profile 应规定而没规定」的兜底判定。

## 三档判定速查

阶段 2 / 3 走到协同点，按下表判定走哪档：

```
1. 是否有 active profile？
   ├── 无 → 直接走 workflow 兜底（无 profile = 全部按兜底）
   └── 有 → 读 profile 对应字段
2. profile 字段是否给出明确规则？
   ├── 给出 → 按 profile
   └── 未给 / 字段缺失 → 走 workflow 兜底
3. profile 规则与 workflow 兜底冲突？
   ├── 是 → 以 profile 为准
   └── 否 → 两者任选（一般 = profile）
```

## agent 自行发挥处的结论区备查

profile 缺席 / profile 无规定而 agent 自行决定时（风格选择、参照用法、几何值
与兜底略有差异），append_brief_conclusion 一行备查：

```
[阶段 2 / 3 协同点] [选择] [依据] [对比 profile 兜底的差异（若有）]
```

续作时按结论区重建现场。

## 反模式

- profile 已规定「不允许 scrim 矩形」时仍调 set_fill 给标题加底——以 profile 为准，重生 hero 配出平静带。
- profile 已规定 `underlap_px = 140 @ W=1080` 时仍传 100——按 profile。
- 字阶与 profile 冲突时按 workflow「字阶规则」节走——必须以 profile 为准（正
  文已点这条优先序）。
- profile 字段读取走 `find_nodes` / 文件系统搜索——profile 已在 system prompt，
  直接查；references 用 `load_reference`，不散查。
