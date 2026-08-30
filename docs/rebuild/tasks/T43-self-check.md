<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T43 自检 · studio 资产文件机制内核（S4 W1 / T-A1）

> **状态**：🚧 进行中（立项动作已自检，实现段随施工滚动填报） | **时间**：2026-08-30 立项 | **负责人**：主 agent
> **关联**：[T43-plan.md](T43-plan.md)（验收标准 C1-C8 以其 §4 为准）

---

## 1. 立项段自检（2026-08-30）

| 项 | 实测 |
|---|---|
| 计划文档 | T43-plan.md 已建（背景/决策点 D-a~D-g/范围 S1-S6/验收 C1-C8/不做/风险） |
| 前置 spike 批 | 已收口落档（spikes/06 + narrative + topics 登记），commit 见分支 `rebuild/mode-arch` |
| tracker/_index 登记 | tracker.md 任务表 T43 行 + 阶段门 Phase 3 行口径更新；tasks/_index.md §2 T43 行 |
| S4 §8 回写 | 01-target-state.md §2 Phase 3 行 + §4 层 1 验收口径改写；records/narrative/01-target-state.md 追加修正记录 |
| 门禁 | `bun run check:zones` clean / `check:docs` 42/42 / `check:bindings` 绿（2026-08-30 立项提交前实测） |

## 2. 门禁机制实录（本任务踩到的 check:tasks 行为）

**【事实】**（2026-08-30 读 `tools/zone-registry/src/check/tasks.ts:355-356`）：`getCommitMessage()` 取 `git log -1 --format=%B`——check:tasks 的 task 指针源是 **HEAD（上一枚）commit 的 message**，不是本次待提交 message。推论：

1. 大改动的 task 指针检查实际校验的是「上一枚 commit 指向的任务」三件套——链条靠连续 commit 均有指针维持；
2. `docs(spike):` 类无指针 commit 会使紧随的大改动 commit 判红（本任务实测：spike 批落地后 T43 立项 commit 被拒）；
3. 处置：spike 批 commit message 携带 `task: T43` 指针（其为 T43+ 解锁前置，指向成立），由此触发「T43 行三件套须在立项时即存在」——本任务的 self-check/verify 因此以**滚动填报**方式提前建档（立项即建文件，如实记「进行中」，收口时全文重写为实测值，不使用占位模板措辞）。

此行为是否与 D11-D15 原意完全吻合，留待 owner 闲时裁决（不阻塞本任务）。

## 3. 实现段自检（随施工填报）

### 3.1 实现清单（2026-08-30）

- `src/app/ai/pi-backend/studio/`：`types.ts`（契约）/ `parse.ts`（`---` frontmatter 切分 + `##`/`###` 正文小节索引）/ `validate.ts`（通用 id/label + workflow types/蓝图节/step_budget + profile 必需节/applicable_to/hex 启发式/字体白名单）/ `registry.ts`（两源扫描、同 id 用户覆盖、loadBase/loadWorkflows/loadProfiles 分载、mode 投影含 general 恒在、整体缺失态、`reloadStudio`/`getStudioRegistry` 单例）/ `index.ts`（公共出口）
- `tests/engine/rebuild/studio-registry.test.ts`：16 用例覆盖 C1-C6（tmp fixture 目录注入，不依赖真实资产）

### 3.2 验收标准实测（T43-plan §4）

| # | 结果 | 证据（2026-08-30） |
|---|---|---|
| C1 两源扫描与同 id 覆盖 | ✅ | 单测 C1 三例（内置注册 / 用户覆盖 workflow+base+用户独有 profile / 用户目录不存在正常态） |
| C2 解析纪律 | ✅ | 单测 C2 两例（缺 frontmatter/YAML 语法错/非 map 三形态 + id≠文件名）；failures 均带 hint |
| C3 workflow 校验 | ✅ | 单测 C3 三例（types 缺失/none 合法/缺蓝图节/空蓝图节/size 非法/step_budget 非正整数） |
| C4 profile 校验 | ✅ | 单测 C4 四例（必需节缺失与空节/no-op 合法/applicable_to 未知 mode 与 general+真实 mode/非法 hex 两形态+短编号不误报/字体白名单双向） |
| C5 base 唯一性与 general | ✅ | 单测 C5 两例（双源皆缺→缺失态 + 全坏→整体态；general 恒在无文件） |
| C6 reload | ✅ | 单测 C6 两例（修复→重载→注册成功 + 删除→mode 消失；reloadStudio(rootDir)/getStudioRegistry 约定目录） |
| C7 门禁与回归 | ✅ | `bunx tsgo --noEmit` 零输出；`bun run lint` 0 errors/5 warnings（既有）；`bun run format:check` 全过；`bun run check:i18n` 全过；`bun run check:vue` exit 0；studio 模块 oxlint 0 errors；`bun test tests/engine/rebuild/` 19/19 |
| C8 登记 | ✅ | 三件套齐 + tracker/_index/01 册回写 + narrative 追加（立项 commit 9f1d1db6 已含） |

### 3.3 全量回归定谳（test:unit:quick）

- 实测（2026-08-30）：**78 fail 行 / 2654 tests / 432 files**；唯一化失败清单 73 例（`grep -E '^\(fail\)' | sort -u`），对照 T42 基线日志（`doc/t42-quick-full.log`，72 例唯一）diff 仅 +1：`MCP server concurrent startServer > two simultaneous startServer calls…`——**隔离复跑 `bun test tests/engine/mcp/server/index.test.ts` 22/22 全绿**，判为全量负载下并发端口 flake（T41 基线 76-77 浮动同款）；其余 72 例与 T42 基线逐名一致，**失败清单零 T43 触改文件**。

### 3.4 实测修正记录

1. **id 字符集**：plan D-d① 原写 kebab-case——S2 自带示例 `ecommerce_detail`/`watercolor_poster_v3` 均为 snake_case，纯 kebab 拒绝规格自身示例；实测后放宽为「小写字母/数字起头 + 连字符/下划线分段」（`isAssetId`），plan D-d 已同步改写。
2. **size 正则**：初版 `/^\d+(x\d+)?$/` 拒绝 HUG 形态 `750x`（x 后无数字）——S2 §4 明文 `Wx` 合法；修为 `/^\d+x\d*$/`（单测 C3 覆盖双形态）。
3. **字体白名单 import 风险排除**：plan §6 风险行「core/text 静态 import 副作用」经 `bun -e` 实测排除（`fontRegistryEntry('Alibaba PuHuiTi')` 命中），未降级为注入式 hook。
4. **lint 收敛**：oxlint 初报 11 errors（complexity 21>20 / 8×no-non-null-assertion / 2×no-unnecessary-condition）——拆分 loadBase/loadWorkflows/loadProfiles、parseWorkflowType 改判别联合、节存在性改 `Object.hasOwn` 后清零。
