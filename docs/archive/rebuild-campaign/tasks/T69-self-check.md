# T69 自检 · watercolor_poster_v2 做透 + golden 场景

> 日期：2026-09-01。实施 = subagent（中断恢复后续作），集成验收 = 主 agent。

## 1. 交付

- `src/app/ai/pi-backend/studio/profiles/watercolor_poster_v2.md` 重写，56 行，frontmatter 四键不动（id/label/applicable_to/version）。
- `tests/engine/rebuild/marketing/golden-watercolor-v2.test.ts` 新增（5 测试，zones 零登记）。

## 2. 七必改落点（subagent 汇报收录）

1. compose_backdrop 实参对齐 T58 → :46（`{root_id, scaffold_id}` 管线内 + `{root_id, hero_image_from}` 外源分支；canvas_width 全文绝迹；canvas_height 按契约缺省跟随根高）。
2. Recipe 接新序 → :44-:46（prepare_hero_scaffold → generate_image composite 参考 + replace_id → compose_backdrop(scaffold_id)；跳步 = 显式失败语义，golden-3 实证 geometry_missing）。
3. 阶段名对齐 hero-first 新五阶段（与 T68 longform.md:15 逐字一致——**集成复核：longform 阶段 2 = hero 物化、阶段 3 = 结构与填充，一致**）。
4. 尺寸去 750 硬编码 → :15/:18/:23/:24/:43/:44（W 取自尺寸预设，750/1080 两档具体数 + W/750 比例缩放 + profile-wins 口径）。
5. hero_composition 键裁决 = **不补**（T57 几何记录仅四数值纯数值消费；heroComposition 仓内无下游消费方 grep 实证；golden-0 反向钉扎）。
6. applicable_to 去 type 提法 → frontmatter 裸键 `[longform]`，正文零 type（golden-0 钉扎）。
7. 加载期校验 → 五必需节齐全非空，studio 三套件全绿。

工具对账：Recipe 每处工具名/参数名/返回消费点均有仓内行号证据（hero-tools.ts:28-56、hero-scaffold.ts:99-110/:281-348、generate.ts:238-300、compose-tools.ts:23-52、compose-backdrop.ts:409-441/:741、look.ts:269）。

## 3. golden 场景一

形态裁决 = **程序性断言进 CI**（可行：T57/T58 core 不依赖桥，setupToolTest 真 SceneGraph；generate_image 落图以「scaffold 写 IMAGE fill」等效模拟，provider 不进 CI）。5 测试：golden-0 profile 文件级钉扎 / golden-1 固定 brief（端午粽子礼盒）+ 750x 字阶与错落堆叠断言（**字阶上下限从真实 profile 文件正则提取——改 profile 即改门禁**）/ golden-2 全链确定性断言 / golden-3 跳步显式失败 / golden-4 幂等重导。真生图视觉三档评分（接缝/标题可读性/节奏感）文档化为手动 4 步流程写于测试文件头，不进 CI。

## 4. 门禁

- subagent 面：`bun test ./tests/engine/rebuild` exit 0（380/0）、`smoke:pi` exit 0。恢复后曾 golden-0 自指失败（Recipe 提及已删参数名触发自家钉扎）→ 措辞修正后归零。
- 集成面：三任务合批复跑全绿（见 T67-self-check §4；format:check 经 oxfmt --write 后 0）。

## 5. 偏差

- golden-0 的 canvas_width 绝迹断言对措辞敏感（Recipe step 4 以「there is no width parameter to pass」表述规避字面命中，语义不变）。
- v3/editorial/solid 三 profile 不在本任务面（v3 含 derive_palette 残留 4 处，另案改写轮）。
