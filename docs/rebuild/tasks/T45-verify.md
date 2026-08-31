<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T45 核验 · manifest 投影改源 + brand 链退役（S4 W1 / T-A3）

> **状态**：✅ 通过（可以收口；7 项轻微发现已全部处置——见 §3） | **时间**：2026-08-31 核验 | **核验人**：subagent（独立，非实现者）
> **关联**：[T45-plan.md](T45-plan.md)（验收标准 C1-C6）/ [T45-self-check.md](T45-self-check.md)
> **被检 commit**：fd890b2f（T45 实现）；核验后尾巴修正随收口 commit 合入

## 1. 逐项结论（V1-V8，全部「过」）

| 项 | 结论 | 核验方亲跑证据（2026-08-31） |
|---|---|---|
| V1 端点实证 | 过 | 复跑 `bun spikes/probes/probe-t45-old-route.mjs` → 旧路径 404 / 新路径 200（modes=[general(0), longform(3)]、profiles=3、failures=1 相对路径）；另写独立探针 dump 全 JSON（tools/rebuild/verify-t45-manifest-dump.mjs）：top-level 仅 modes/profiles/failures、profile 三无 body/markdown 键、全文无盘符泄漏；复跑 prompt-assembly-smoke → 29/29 |
| V2 brand 链零残留 | 过 | `grep -rn -E "loadBrandSeed\|toBrandManifest\|PiBrandManifest\|api/pi/brand/manifest\|piBrandManifest\|ensurePiBrandManifest" src/ tests/ scripts/ tools/ spikes/ packages/` 零命中；`git ls-tree -r HEAD` 无 brand/；`git diff febfefdc..fd890b2f -- src/app/ai/pi-backend/modes.ts` 为空（D-h 成立） |
| V3 单测真实性 | 过 | 通读投影/适配/测试三方，断言精确（toEqual 全等、键集排序比对、`not.toContain(builtinDir)` 反绝对路径、整体态正反两例）；`bun test tests/engine/rebuild/` → 25/25 |
| V4 前端实证 | 过 | Read 仓外 doc/t45-profile-dropdown.png → 下拉列出 No style profile + 三精品；**亲跑** bind 冒烟（自起 1422/7702 dev server，node）→ 17/17；跑后清理无孤儿进程，未碰 1420/7700（对方 worktree） |
| V5 门禁九项 | 过 | zones clean / docs 42/42 / tasks 增量跳过（V8 人工核）/ bindings 全绿 / lint 0 errors / tsgo 0 / vue-tsc 0 / format 全绿 / i18n in sync |
| V6 回归对照 | 过 | 复核 doc/t45-regression-run.log（仓外） 尾 78 fail/2660/434 文件；`diff /tmp/t44-fails.txt doc/t45-failures.txt（仓外）` 仅 +1 行（fig export subgraph flake）；T45 文件 grep 零命中；亲复跑 `bun test tests/engine/io/subgraph.test.ts` → 4/4 |
| V7 缺陷面狩猎 | 过 | 消费面双向 grep 穷尽无漏网；server.ts 401 先于 405（fail-close）；自检 §3 修正记录与代码现状吻合。发现 7 项轻微问题（§3），无阻断 |
| V8 登记面 | 过 | tracker.md 与 _index.md 的 T45 行三链接齐全、状态符合流程；三件套无禁用占位词 |

**总结论：可以收口。**

## 2. C1-C6 验收映射

- **C1** ✅ V1：新端点三段俱全 + 旧路径 404（双探针 + 冒烟 29/29 三重实证）。
- **C2** ✅ V2：brand/ 删除 + 六符号 grep 零残留（含 packages/ 扩圈）；modes.ts 不动。
- **C3** ✅ V3 + V1：适配纯函数单测精确；overlay 端侧实证含在 29/29 内。
- **C4** ✅ V4：截图 + 核验方亲跑 bind 冒烟 17/17（双证据）。
- **C5** ✅ V3/V5/V6：25/25、九门禁、回归唯一 diff=已知 flake。
- **C6** ✅ V8 + 本收口 commit 翻转状态。

## 3. 核验发现与处置（7 项，均轻微；1-6 随收口 commit 修复，7 为说明）

1. **system-prompt-marketing.md 残留「brand config」prose**（:55/:69——LLM 会被引导去查不存在的配置）→ **已修**：两处改 studio registry 措辞，复跑 assembly smoke 29/29 绿。
2. **service.ts 启动快照与 reloadStudio 不联动的潜伏语义** → **已修**：启动加载处补注释（快照语义 + 将来接触发面须改请求时取值）。
3. **studioOverlayInput 不过滤 deprecated 的设计待定** → **已成文**：适配函数头注写明「已选中后被废弃仍注入、下拉已隐藏」语义，决策挂 S2 §5 / T-B10。
4. **overlay 测试 'none' 分支无直接断言** → **已修**：测试扩 creative.md（types: none）fixture，钉扎零贡献 + 投影侧 `types: []`；顺手把 failures 路径断言改为正斜杠字面量（配合第 6 项）。25/25 绿。
5. **冒烟与 Vue 注释残留「种子」**（5 处装饰性）→ **已修**（check 标签与注释改「注册表/无资产」口径；头注的历史叙述保留——那是改动本身的记录）。
6. **relPath 用 node path.join 产出（Windows 反斜杠）** → **已修**：registry 源头统一 `replaceAll('\\', '/')` 正斜杠，字段注释写明跨平台口径；测试断言同步。
7. **overlay 段题「## Material types in the current brand」系有意保留**（复刻上游 byte-mirror，prompt-overlay.ts 头注有记录）→ 非缺陷，不动。

修复后复跑：`bun test tests/engine/rebuild/` 25/25、assembly smoke 29/29、format/lint/tsgo/vue/i18n 全绿（2026-08-31，主 agent 执行）。

## 4. 核验过程附记

- 核验方落的探针文件 tools/rebuild/verify-t45-manifest-dump.mjs（+ .json 输出）作为 V1 证据随收口 commit 登记。
- 核验方 V4 可选项（亲跑 bind 冒烟）已执行，非采信自述。
- check:zones added 计数差值（382 vs 自检 379）已查明 = 核验方探针文件 + 未跟踪回归日志，非被检方问题。
