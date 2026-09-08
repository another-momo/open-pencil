# hero 候选生图 prompt 模板

阶段 2（hero 物化）写候选 prompt 之前读本篇；阶段 3 续填需要的视觉素材
（产品图 / 配图）也可参照「prompt 工程」节。本篇管 prompt 构造与回图诊断；
坐标系 / 几何记录口径归 `coordinates.md`；生图工具调用与图片路由（AI 生成 vs
stock_photo vs 用户素材）归正文。

## 候选 prompt 必备三段

每个候选的 prompt = **风格定调 + 参照用法 + 文字禁令** 三段拼装。下面分别给。

### 风格定调（CP1 锁定方向 → 短句）

```
[视觉方向 / 风格词 2~4 个],
[构图: hero 主体的机位/尺度/留白关系],
[色彩氛围: 锁定方向下的色相/明度倾向（不要 hex）],
[题材择一: 单一主语 + 环境要素, 不堆元素]
```

例（不照抄——按 CP1 锁定方向改）：

> soft layered watercolor wash, one continuous quiet motif (single bare branch
> with sparse blossoms), generous negative space, low-saturation pale
> grey-blue atmosphere, full-bleed composition, no harsh edges

### 参照用法（必备，缺则图必坏）

围绕标题构图、标题区保持平静低细节、画面中不画任何文字——**这三句是参照用法的最小集**，缺一项必出问题：

- 围绕标题构图：「围绕本参考帧中标题版式所在位置安排主体，标题区周围保持平静」
- 标题区平静低细节：「标题覆盖区域为低细节、低对比、单一色调的连续带，无物体、无图案、无边缘、无高对比符号」
- 不画文字：「画面中不出现任何文字、字符、符号、记号、标签、徽章」（重申因多模态生图负向指令不稳定，正向描述「无字」是兜底）

例：

> The provided reference frame shows a title block in the lower-third region.
> Compose the subject (a single bare branch) around that block, NOT behind it.
> The title band area must stay low-detail, low-contrast, smooth, and free of
> any objects, patterns, edges, or symbols.

### 文字禁令（必带，明写而不是负向）

> The image must contain no text, no lettering, no characters, no symbols, no
> logos, no watermarks, no marks of any kind.

**实测：负向指令「no text, no lettering」在多模态生图里无效**——负向 prompt 走
CFG 通道是扩散模型的事，多模态生图没这条通路。明写「画面中不出现任何文字」加
正向描述「标题区是平静低细节的连续带」联合使用才稳。

## 候选变异纪律

- 一批内只动**一个变量轴**（构图 / 氛围 / 题材三者择一）。
- 风格词与标题参照锁同——一批内不变。
- 整批重生 ×2 仍未选中 → 走正文「脱困阀」节（不重抽签）。
- 每次整批重生 append_brief_conclusion 一行（批次、变量轴、结果）。

## 工具参数（与正文纪律配合）

- `width` / `height` 取 `prepare_hero_scaffold` 返回值，**不用散文描述画幅**（参数是确定的，散文是概率的）。
- `references` 传 `scaffold` 节点——prompt 里同时明写「围绕参考帧中标题版式构图」（参数传 + 文字呼应双重保险）。
- `replace_id = scaffold_id`——一张图就替换整张参考帧；不重复落多个候选节点。
- API 会按 16px 对齐裁到约束比例，结果 note 里报告——落位后用 `describe` 核实实际尺寸。

## 续填素材（阶段 3）prompt 模式

阶段 3 配图（产品图 / 配图 / 节次主图）的 prompt 套同一模板，但参照用法段改为
节次语境：

- 主体紧致、四周留空（便于落位与裁切）
- 题材 = 锁定方向下的节次主语（与 hero 同一风格锚）
- 风格尾缀 = CP1 锁定风格词
- 文字禁令同上

多张配图走 `generate_image` 的 `requests` 数组一批发——并发、互不依赖才能并发；
基于返回图再修的迭代必须串行。

## 回图诊断（fast look 复查项）

按本表逐图扫一遍：

| 症状                  | 检测                                                  | 动作                                                  |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 图内出现文字/字符     | look 候选节点（纯位图走 `original-bytes` 通道看原图） | 重生，prompt 强化「不画字」+ 标题区正向「平静低细节」 |
| 标题区被主体盖住      | look 根框 / hero 区，参照 scaffold 比对               | 重生，prompt 强化「围绕标题构图」「标题区无主体」     |
| 比例不符 scaffold     | describe 报宽度与 scaffold.width 不符                 | 容器 `overflow="hidden"` 承裁，不拉伸；不裁到载文带   |
| 风格漂出 CP1 锁定     | 与 CP1 锁定方向对比                                   | 重生，风格词首句重述锁定方向                          |
| 镂空/透明资产带棋盘格 | look 空角                                             | 不重抽该图，改设计绕开或换 stock_photo / 用户素材     |

## 反模式

- 散文里写「适合加标题」/「给 logo 留位置」——实测触发占位物。
- 负向 prompt 单写「no text」——实测无效。
- 候选里给同一变量轴两次——用户选不出差异。
- 候选里不写标题区正向「平静低细节」——正负指令双保险缺一半。
- 用 hex 数字锁色——CP1 锁定的是方向，色域由 `compose_backdrop` 采样定。
