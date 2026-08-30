<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T43 计划 · studio 资产文件机制内核（S4 W1 / T-A1）

> **状态**：🚧 进行中 | **时间**：2026-08-30 立项 | **负责人**：主 agent
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`，从 `rebuild/pi` 83a9687d 拉出；spike 批 e57edd94 后）
> **规格真源**：[S2 资产文件机制规格 v2](../../../doc/S2-asset-files-spec.md) §1/§2/§8（仓外 doc/ 系列）；[S4 Phase 3 计划 v2](../../../doc/S4-phase3-plan.md) §4 W1 T-A1 行；PD-7/PD-16/PD-17（[19-product-design-decisions.md](../../../doc/202608251637-migration-proposal/19-product-design-decisions.md)）

## 1. 背景与立项

owner /goal（2026-08-30 原文节录）：「目前产品讨论基本成形，开始实施。先做spike，然后正式推进。但这是一次较大的架构调整，请开一个新的worktree，拉一个新的分支来实施，不要在原来的rebuild/pi上直接改」

前置 spike 批已收口（[spikes/06-p3-mode-arch-spikes.zh.md](../spikes/06-p3-mode-arch-spikes.zh.md)，e57edd94）：SP-a1/SP-b/SP-c 成立，SP-a2 阻塞登记（不挡本批），SP-d 递延。Phase 3 解锁，本任务 = W1 第一锤。

**S4 T-A1 行原文**：「文件机制内核：目录扫描/frontmatter 解析/注册表/用户目录覆盖/加载期校验 lint + 失败显式暴露（S2 §1/§8）——三类资产（base/workflows/profiles）统一机制」。

**现状接缝盘点**（2026-08-30 本 worktree 实测）：

- 旧机制 = `src/app/ai/pi-backend/brand/`（`index.ts` 加载 `config.yaml` 单层 YAML 种子 + `manifest.ts` 脱敏投影，T24 建）：本任务**并存不扰动**（D-g），迁移归 T-A2、投影换源归 T-A3。
- `yaml@^2.9.0` 已在根 package.json 依赖（`grep '"yaml"' package.json`）；brand/index.ts 即以 `parse` from `'yaml'` 解析——frontmatter 解析复用同包，不引新依赖（D-b）。
- 字体白名单校验所需的注册表访问器 `fontRegistryEntry` 经 `@open-pencil/core/text` 导出（`packages/core/src/text/fonts.ts:27` re-export，pi-backend 已有 `@open-pencil/core/*` import 先例：tools.ts:37 / host.ts:33 / attach.ts:15）。
- 内置资产目录 `src/app/ai/pi-backend/studio/` 当前**不存在**（`ls src/app/ai/pi-backend/` 实测，2026-08-30）——本任务只建机制与目录骨架，**不带任何真实资产文件**（PD-16 无占位原则；资产随 T-A2/A4/A5 落位）。
- zones：`src/app/ai/pi-backend/` 与 `tests/engine/rebuild/` 均为 ownedRoot（`tools/zone-registry/zones.json` ownedRoots），新文件免逐件登记。

## 2. 决策点（本任务开工前拍板/默认项登记）

| # | 决策点 | 状态 | 取值 |
|---|---|---|---|
| D-a | 模块布局 | ✅ | `src/app/ai/pi-backend/studio/`：`types.ts`（契约类型）/ `parse.ts`（frontmatter+正文切分）/ `validate.ts`（按类 lint）/ `registry.ts`（扫描+覆盖+注册表+reload）/ `index.ts`（公共出口）。资产子目录骨架 `studio/base.md` 位 + `studio/workflows/` + `studio/profiles/`（本任务不建资产文件，仅机制认识这三个位置） |
| D-b | frontmatter 解析 | ✅ | 手写 `---` 块切分 + `yaml` 包 parse（brand/index.ts 同款）；不引 gray-matter。切分失败/非 map 即校验失败 |
| D-c | 热重载 | ✅ v1 降级 | 启动加载 + 显式 `reloadStudio()` API；**不做 fs.watch**（S2 §2 明文授权「实现成本过高时可降级为重新加载命令/按钮」——watch 归入后续优化尾巴） |
| D-d | 校验面 v1 | ✅ | ①通用：frontmatter 可解析且为 map、`id` 必填且与文件名一致（kebab-case）、`label` 必填 ②workflow：`types` 必填（列表或 `none`）；列表每 type 需 id/label/size，且**同名正文小节存在且非空**（S2 §4 必填体节）；`step_budget` 若存在须正整数 ③profile：必需小节（Fixed system/Variable system/Anti-identity/Tone/Recipe）非空或节内显式 `no-op`（S2 §5）；`applicable_to` 引用完整性（mode id 存在于注册表或 `general`）；hex 色值格式检查；**字体白名单**经 `fontRegistryEntry` 校验（core 引用链已实证存在） ④base：至多一份生效（用户覆盖内置）；全缺 → failures 记整体缺失态 |
| D-e | general mode 特例 | ✅ | 注册表恒含 `general`（内置特例，无 workflow 文件，S2 §2）；`applicable_to` 与 mode 存在性校验把 general 算作合法引用 |
| D-f | 失败暴露面 | ✅ | 注册表持 `failures: StudioFailure[]`（path/kind/reason/hint）；公共读 API `getStudioRegistry()` / `reloadStudio()`；UI 与 manifest 暴露归 T-A3/T-B10，本任务只出数据面 |
| D-g | 旧 brand/ 处置 | ✅ 并存不扰动 | 本任务零改动 brand/；T-A2 迁移、T-A3 换源后才退役 |

## 3. 范围与修法

### S1 契约类型（`studio/types.ts`）

```ts
StudioAssetKind = 'base' | 'workflow' | 'profile'
StudioWorkflowType = { id, label, size, safeArea? }        // size: 'WxH' 固定 | 'Wx' HUG 自适应高（S2 §4）
StudioWorkflow = { id, label, subtitle?, stepBudget?, types: 'none' | StudioWorkflowType[], body, sections: Map<string,string>, origin: 'builtin'|'user', path }
StudioProfile  = { id, label, applicableTo[], heroComposition?, version?, deprecated, body, sections, origin, path }
StudioBase     = { body, origin, path }
StudioFailure  = { path, kind, reason, hint }              // hint = 修复指引（S2 §8「失败文件+原因+修复指引」）
StudioRegistry = { base: StudioBase | null, workflows: Map<id, StudioWorkflow>, profiles: Map<id, StudioProfile>, modes: [{id:'general',...} + workflow 文件派生 mode], failures: StudioFailure[] }
```

### S2 扫描与解析（`studio/parse.ts` + `studio/registry.ts`）

- 两源扫描：内置 `src/app/ai/pi-backend/studio/`（路径解析对齐 brand/index.ts 的 cwd 相对约定）→ 用户 `~/.openpencil/studio/`（`os.homedir()` 展开，Windows 安全）；用户目录不存在/为空 = 正常态（S2 §8）。
- 覆盖语义：同 id（= 文件名去 .md）用户文件取代内置同 id 文件进入候选集；base 同理（唯一槽位）。
- 解析：utf-8 读文件 → `---` frontmatter 块切分（文件首行必须是 `---`，否则校验失败「缺 frontmatter」）→ yaml parse → 正文按 `##` 二级标题切 sections（workflow 的 type 蓝图节为 `###` 三级，归并入所属 `## type 蓝图` 下按三级标题建索引——施工细节：sections 索引同时收录二级与三级标题，校验与后续组装各取所需）。
- 解析异常不 throw 出加载主流程——单文件失败只入 failures（S2 §8「其余文件正常可用」）。

### S3 校验（`studio/validate.ts`）

按 D-d 四面执行；每文件产出「注册」或「failure（含修复指引文案）」。字体白名单：`fontRegistryEntry(family)` 未命中 → failure（指引：家族须存在于字体注册表，T39 机制）。hex 检查：正文与 frontmatter 中 `#xxxxxx` 形态抽样正则（`/#[0-9a-fA-F]{3,8}\b/` 的非法形态侦测——非法 hex 字面量如 `#12`/`#gg0000` 报失败）。

### S4 注册表与公共出口（`studio/registry.ts` + `studio/index.ts`）

- `loadStudio()`（启动一次）/ `reloadStudio()`（显式重载，幂等）/ `getStudioRegistry()`（读当前注册表）。
- modes 投影：`general` 恒在 + 每个成功注册的 workflow 文件派生一个 mode（id=文件 id，label 取 frontmatter）——PD-16「文件存在 = mode 可用」的数据源。
- 默认集整体缺失/全坏（base 与全部 workflow/profile 均失败且无任何注册成功）→ failures 记一条整体态（kind 标记），供 T-B10 错误条消费（S2 §8）。

### S5 单测（`tests/engine/rebuild/studio-registry.test.ts`）

tmp fixture 目录（`mkdtemp`）构造内置/用户两源，覆盖 C1-C7 全部断言；不依赖真实资产文件（T-A2 前内置目录为空是设计态）。

### S6 回写（S4 §8 回写动作，随立项提交）

- `01-target-state.md` §2 表 Phase 3 行改写为「长图薄闭环（多 mode 架构）」；§4 层 1 验收口径改写为 S4 §6 四条（T-D1/T-D2 冒烟 + smoke:pi + CI）。
- `tracker.md` 阶段门 Phase 3 行出口标准同步 + 任务表加 T43 行；`tasks/_index.md` 加 T43 条目。
- `records/narrative/01-target-state.md` 追加回写记录（bindings 纪律）。

## 4. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| C1 | 两源扫描与同 id 覆盖：用户目录同 id 文件取代内置（base/workflow/profile 三类各一例）；用户目录缺失/为空为正常态 | 单测 |
| C2 | 解析纪律：合法文件注册成功；坏 frontmatter（缺块/非 map/yaml 语法错）→ 不注册 + failures 带原因与修复指引，其余文件不受影响 | 单测 |
| C3 | workflow 校验：`types` 缺失 → 失败；`types: none` 合法；type 缺同名正文节或节空 → 失败；step_budget 非正整数 → 失败 | 单测 |
| C4 | profile 校验：必需小节空且无 no-op → 失败；`applicable_to` 引用不存在 mode → 失败；非法 hex → 失败；字体不在注册表 → 失败 | 单测 |
| C5 | base 唯一性：用户 base 覆盖内置；双源皆缺 → failures 记整体缺失态；general mode 恒在注册表 | 单测 |
| C6 | `reloadStudio()` 幂等且反映文件增/改/删（含失败 → 修复 → 重载后注册成功路径） | 单测 |
| C7 | 全门禁绿（check:zones/check:docs/check:tasks/check:bindings/lint/tsgo/oxfmt）+ 既有单测零回归 | 门禁实测 |
| C8 | 三件套齐 + tracker/_index/01 册回写 + narrative 追加 | check:tasks / check:bindings |

## 5. 不做（out of scope）

- config.yaml 拆解迁移与 profiles 内容（T-A2）；manifest 端点更名与投影（T-A3）；`longform.md` 骨架与 workflow 内容（T-A4）；base.md 内容落位与红线补洞（T-A5）。
- chips/选择器/错误条 UI（T-B10）；每回合组装与宿主路由（T-B9）。
- fs.watch 热重载（D-c 降级）；types 外部目录形态 `types: dir:...`（PD-17：v1 不实现，仅 schema 注释预留）；web 无后端静态兜底（S2 §8 开放尾巴）。
- golden 评测基线（随 T-C3）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| pi-backend → `@open-pencil/core/text` import 拉起 core 重依赖（CanvasKit 加载链） | `fontRegistryEntry` 是纯数据访问器（registry.ts 零运行时副作用【假设——施工时首验】）；若实测拉起副作用，字体 lint 降级为注入式 hook + 挂 S4 §7 尾巴表 |
| 内置目录路径在打包/独立后端进程下 cwd 漂移 | 沿用 brand/index.ts 既有路径约定（同进程模型，T24 已实证）；单测以 fixture 注入路径，不依赖 cwd |
| 三级标题节索引与「正文按 ## 切」的口径含混 | parse.ts 统一产出二级+三级混合 sections 索引并在类型注释写清；校验只消费该索引单源 |
| 用户目录同 id 覆盖误伤（用户写错 id 反而新建） | id=文件名强一致校验（D-d①）即防线；失败入 failures 可见 |
