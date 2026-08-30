<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T45 计划 · manifest 投影改源 + brand 链退役（S4 W1 / T-A3）

> **状态**：🔄 进行中 | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T44 收口 62499594 之后）
> **规格真源**：[S2 资产文件机制规格 v2](../../../doc/S2-asset-files-spec.md) §2（brand 命名废弃+端点更名）/ §8（失败显式暴露数据面）；[S4 Phase 3 计划 v2](../../../doc/S4-phase3-plan.md) §4 W1 T-A3 行

## 1. 背景与立项

T44 已把 config.yaml 内容迁入 studio 文件集（profiles×3 + longform.md 骨架），但消费面仍走 T24 的 brand 链：service.ts 启动 `loadBrandSeed` → prompt-overlay / `GET /api/pi/brand/manifest`。本任务把消费面整体改源到 T43 建成的 studio 注册表，并同步退役 brand 链（config.yaml 删除、`loadBrandSeed`/`toBrandManifest` 退休、brand/ 目录移除）。

消费面全景（2026-08-31 逐一 Read/grep 实证）：

| 消费方 | 现状 |
|---|---|
| `service.ts` | :45 import brand、:121 启动加载、:209 overlay 输入（types/profiles）、:408 getBrandManifest |
| `server.ts` | :246 路由名 `/api/pi/brand/manifest`、:273 调 getBrandManifest |
| `prompt-overlay.ts` | :16 类型 import brand/manifest；输出文案含 "brand config" |
| `mode-selection.ts` | fetch 旧端点 + PiBrandManifest 类型 + piBrandManifest 符号 |
| `ChatStyleProfileSelect.vue` | 只读 `piBrandManifest.profiles` 平铺列表 |
| 测试/脚本 | **零消费**（`grep -rln "buildMarketingOverlay\|brand/manifest\|brandManifest\|getBrandManifest" tests/ scripts/ tools/` 无命中，2026-08-31） |

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a 新契约形状**（`studio/manifest.ts` 单源，前后端 `import type` 共用，同 chat-mode.ts 先例）：
  ```ts
  PiStudioManifest = {
    modes: { id, label, subtitle?, source: 'general'|'workflow', types: StudioWorkflowType[] }[]
    profiles: { id, label, applicableTo: string[] }[]     // 摘要平铺，body 不下发（T24 D7 信任边界维持）
    failures: { origin: 'builtin'|'user', path, kind, reason, hint }[]  // S2 §8 数据面
  }
  ```
  - modes：general 恒在首位且 `types: []`；每注册 workflow 一条，types 展开（`none` → `[]`）。
  - failures 的 path **脱敏为相对各自 studio 根的相对路径**（registry 内部是绝对路径，绝对路径不下发——信任边界延伸）。
  - 旧 `name` 字段（"默认品牌库"）随 brand 概念废弃，不留。
- **D-b 端点更名不留兼容**：`/api/pi/brand/manifest` → `/api/pi/studio/manifest`。内部前后端同仓同步改；grep 实证无测试/脚本/第三方消费旧路径（2026-08-31）。旧路径更名后不命中只读路由表（落 404——实证记录实际行为）。
- **D-c service 改源**：启动加载 `loadBrandSeed(rootDir)` → `getStudioRegistry(rootDir)`（T43 公共 API，约定目录：内置 `<rootDir>/src/app/ai/pi-backend/studio/` + 用户 `~/.openpencil/studio/`）；overlay 输入适配抽纯函数 `studioOverlayInput(registry)`（types = 各 workflow types 展平；profiles = `{id, markdown: body}`）；`getBrandManifest()` → `getStudioManifest()` 返回 `toStudioManifest(registry)`。
- **D-d 投影函数纯函数化**：`toStudioManifest(registry)` 入 `studio/manifest.ts`（契约 + 投影同文件，brand/manifest.ts 先例扩展）；单测覆盖（S7）。
- **D-e 前端同步更名**：mode-selection fetch 新端点 + 类型换源 + 符号 `piBrandManifest` → `piStudioManifest`；ChatStyleProfileSelect 续用 profiles 平铺字段（三轴 chips 重做是 T-B10，本任务不重建 UI，仅改数据源与注释）。
- **D-f brand/ 目录整体删除**（config.yaml / index.ts / manifest.ts）；prompt-overlay.ts 类型换源 + 输出文案 "brand config" → studio 措辞（无测试钉字面，grep 实证 2026-08-31）；studio/parse.ts、registry.ts 头注中「brand/index.ts 先例」表述顺手改（文件退役后不留 dangling 引用）。
- **D-g 中间态容忍**：base.md 未落位（T-A5）→ registry failures 恒含 base 缺失一条 → manifest.failures 带此条（恰是 S2 §8 数据面的真实演示）；前端下拉不读 failures 不受影响；T44 钉扎测试断言不动（T-A5 收零）。
- **D-h modes.ts 双模注册表不动**：T24 的 ui/marketing chat mode 与本任务的 mode（general/longform）是两层概念；UI 模式废弃（PD-16）属后续任务范围。

## 3. 范围与修法

- **S1** `studio/manifest.ts`：契约类型 + `toStudioManifest(registry)` 纯投影（failures 路径相对化：内置源剥 `<builtinDir>` 前缀、用户源剥 `<userDir>` 前缀——投影需两目录入参或由 registry 携带 origin 信息；施工时以最小改动定）。
- **S2** `service.ts`：改源（D-c），overlay 适配纯函数 + getStudioManifest。
- **S3** `server.ts`：路由名 + 注释 + 调用更名。
- **S4** `prompt-overlay.ts`：类型换源 + 文案措辞（brand config → studio registry）。
- **S5** `mode-selection.ts` + `ChatStyleProfileSelect.vue`：前端更名换源（D-e）。
- **S6** 删除 `brand/` 目录 + studio 头注顺手改（D-f）。
- **S7** `tests/engine/rebuild/studio-manifest.test.ts`：投影单测——modes 展开（general 空 types / longform 三 type）/ profiles 摘要无 body / failures 相对路径脱敏 / 整体缺失态投影。
- **S8** 实证：dev server 起后端 → curl 新端点（modes/profiles/failures 三段俱全）+ 旧路径不命中；Playwright 开 app → profile 下拉经新端点列出三精品（截图存仓外 doc/t45-*.png）。
- **S9** 登记：tracker/_index/三件套。

## 4. 验收标准

- **C1** 新端点实证：`GET /api/pi/studio/manifest` 200，modes（general + longform，后者三 type）/profiles（三摘要、无 body 字段）/failures（含 base 缺失、path 为相对路径）三段俱全；旧路径 `/api/pi/brand/manifest` 不命中（实证记录实际状态码）。
- **C2** brand 链退休：`brand/` 目录删除；全仓 `grep -rn "loadBrandSeed|toBrandManifest|PiBrandManifest|api/pi/brand/manifest" src/ tests/ scripts/ tools/` 零残留（docs/rebuild 历史档案——T24 三件套、01 旧五环表——为封存记录不改）。
- **C3** overlay 改源：marketing overlay 输入来自 studio registry（适配纯函数单测证明）。
- **C4** 前端实证：Playwright 实证 profile 下拉经新端点工作（截图仓外 doc/t45-*.png）。
- **C5** 新单测绿 + `bun test tests/engine/rebuild/` 不回归 + 门禁九项全绿 + 全量回归对照 T44 基线（77 fail/2655）失败数不增、唯一化 diff 零本任务文件。
- **C6** 三件套 + tracker/_index 登记齐全。

## 5. 不做（out of scope）

- 不重建选择器 UI（三轴 chips = T-B10）。
- 不做每回合组装改造（S2 §6，W2/W3 范围）；overlay 仅换数据源，输出形状/注入时机不动。
- 不动 modes.ts 的 ui/marketing 注册表（D-h）。
- 不写 base.md（T-A5）。
- 不做 fs.watch 热重载（T43 已降级；manifest 读的是进程内注册表快照）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| failures 相对化需注册表携带来源目录信息（现 StudioFailure.path 为绝对路径、origin 为 builtin/user） | 投影层剥前缀：service 侧已知 rootDir 与 homedir 约定（T43 公共 API 同源推导）；若类型需扩（如 registry 存相对路径），顺手改 T43 类型并同步钉扎测试 |
| vite 插件 spawn 后端进程的 rootDir 与 studio 约定目录不一致 | brand 同进程模型已实证（T24 起在线）；实证步骤 S8 直接验证 |
| 端点更名漏改消费者 | grep 实证消费面仅 5 文件（见 §1 表）；C2 grep 卡口 |
| 回退 | 全部改动为一个 commit 集合，git revert 即回退；config.yaml 从 git 历史恢复 |
