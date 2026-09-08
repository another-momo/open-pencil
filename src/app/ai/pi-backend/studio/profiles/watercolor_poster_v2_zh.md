---
id: watercolor_poster_v2_zh
label: 水彩海报 v2（中文）
applicable_to: [longform-hero-kv-first, longform-structure-first]
version: 2
---

# 水彩海报

水彩叠染风格的长图与活动主视觉。视觉重量来自贯穿所有 section 的连续背景，而不是每个 section 各自的色块。Profile 按设计要素（Typography / Color / Layout / Hero treatment / Forbidden / Tone）组织；工序（recipe）归 workflow 侧。

## Typography

- 极端字阶对比：按画布宽度 W 比例缩放——W 取 workflow 尺寸预设的值，绝不硬编码。W=750（电商详情长图）档：hero 标题 72–110px，section 标题 36–48，正文 20–24，注释 16–18。W=1080（小红书长图）档：hero 标题 104–158，section 标题 52–70，正文 28–34，注释 22–26。其他宽度按 750 档等比例缩放（系数 ≈ W/750）。Workflow 的画布字阶规则与本 profile 冲突时，以 profile 为准。
- 标题 2–3 行短句错落：每行 3–5 字、左对齐、逐行水平错位、行距收紧（1.0–1.15），绝不用居中大通栏。字重：标题 Heavy/Black，正文 Regular。
- 标题阴影是白字特权：只有深底/饱和底上的白字可以带阴影。浅底上的深墨标题不带阴影——墨压水彩靠对比本身。
- 眉题（eyebrow）：{ 无（默认）, 标题组上方一行小字 }——18–24px（W=750 档）/ 26–34px（W=1080 档），Regular，拉开字距，与标题同色系。眉题是注记（日期/地点/系列名），不是第二个标题。

## Color

- 配色：自动从 hero 底部过渡带采样（compose_backdrop）——不用固定 hex。
- 和谐取向（harmony）决定采样色向全幅扩展的方式（analogous / complementary / split-complementary / triadic / monochromatic，每设计选定一种）——profile 不锁定具体类型，只约束水彩叠染的调性：柔和叠染的色层、无近黑重音、无商业渐变。视觉重量属于背景，section body 保持透明让叠染穿过来。

## Layout

- 所有 section 共享一个连续背景。给每个 section 各自配底色块是另一种风格。
- 刻意不均的疏密节奏：hero → 大留白 → 密集段 → 紧凑 → 再大留白。section 顺序与密度由内容决定，但保持不均节奏——恒定节奏读起来像界面。
- 正文密集处若与水彩打架，允许 alpha < 0.5 的半透明辅助层让共享背景透出——标题可读性仍来自图像影调，不来自补丁。

## Hero treatment

- hero 锁位（lockup）：{ lower-third（默认）, center-left, upper-float }——错落标题组在 hero 槽位里的位置。行数预算：lower-third / center-left 可 2–3 行；upper-float 至多 2 行（3 行会挤顶边）。
- hero 高度：{ 默认 = W（W=750 即 750，W=1080 即 1080），范围 0.8W–1.2W（W=750 即 600–900，W=1080 即 860–1300） }——意象简单可取矮，意象需要空间可取高。
- scaffold 参数：underlap_px 与 transition_zone_px 在 W=750 档默认 100；按 W 比例缩放，1080 档约 140；transition_zone_px 大于 underlap_px 时被钳制（结果带 `clamped: true`）。scaffold 的合成参照把标题组的真实位置展示给生图 AI——prompt 必须让该区域保持平静、低细节、贴合标题色。
- 标题带必须落在 hero 图的平静低细节区，且影调明确偏浅或偏深（浅带配深字、深带配白字），不要中间调。
- 水彩风格 prompt：柔和叠染、单一意象、大量留白。图像按 scaffold 的最终显示尺寸生成（API 可能 16px 对齐——按近似显示结果构图）。底部 underlap 带保持平静——它 ≈1:1 映射到渐隐区。
- 意象（motif）：水彩隐喻跟随需求单（一个季节、一个地点、一种情绪）——一图一个意象，不做拼贴。

## Forbidden

- hero 槽位内：标题背后不放不透明（alpha=1）底板——不用蒙层矩形、色带、模糊背卡。标题可读性来自图像影调，不来自补丁。
- 内容 section：不用底色块或卡片布局切割共享背景——视觉重量属于背景。
- 不用单行/居中标题通栏——错落 2–3 行才是本风格的标题。
- 深墨标题不带阴影；白字阴影不超出 blur 8–16，alpha ≤ 0.3，y 偏移 0–4 的范围——重阴影、模糊阴影一律不收。
- 不在 hero 上叠透明装饰 PNG——AI 生图的 alpha 通道不可靠，装饰元素画进 hero 图内部。
- 不用硬销话术（"限时秒杀""最后一天"）。
- 不用调 overlay 透明度抢救不可读的标题带——重跑 compose_backdrop 重新采样，或按更平静的标题带重生 hero。

## Tone

克制、有氛围感。短句。标题文案偏好名词性意象（一个季节、一个地点、一种质感）而非动宾口号；6–15 字拆进 2–3 行错落标题。
