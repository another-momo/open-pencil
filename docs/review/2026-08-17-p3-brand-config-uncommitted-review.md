# P3 Brand Config 化 — 未提交代码 Review

> 日期: 2026-08-17
> 对照文档: `docs/plans/tasks/agent-backend-p3-brand-config.md` (P3 计划)
> 范围: `git status` 显示的全部未提交变更 (39 修改 + 10 删除 + 10 新建)

---

## 一、变更概览

| 类别 | 文件数 | 行数 | 说明 |
|---|---|---|---|
| 修改 | 39 | −4430 / +504 | 核心简化为主，大量 anchor/library 代码被移除 |
| 删除 | 10 | — | clone.ts, validate.ts, library.ts, default-library.fig, tools/marketing-library/ 等 |
| 新建 | 10 | — | brand/ 模块 (7 文件), routes/brand.ts, BrandConfigPanel.vue, config.yaml, CI workflow 等 |

核心架构方向正确：SQLite 双层模型 (default + user) + YAML schema + REST API + frontend shim。

---

## 二、已正确完成项

### 2.1 文件删除清单 (10/10)

| 文件 | 计划要求 | 状态 |
|---|---|---|
| `packages/core/src/tools/marketing/clone.ts` | 删除 | ✅ |
| `packages/core/src/tools/marketing/validate.ts` | 删除 | ✅ |
| `packages/core/src/tools/marketing/library.ts` | 删除 | ✅ |
| `packages/agent/src/prompts/library-snapshot.ts` | 简化 (保留 shim) | ✅ |
| `public/default-library.fig` | 删除 | ✅ |
| `tools/marketing-library/src/generate.ts` + `tests/` + `package.json` | 删除整个目录 | ✅ |
| `tests/helpers/marketing-library.ts` | 简化为 no-op shim | ✅ |
| `tests/engine/tools/marketing/{library,validate,clone}.test.ts` | 删除 | ✅ |
| `tests/engine/app/marketing-library.test.ts` | 删除 | ✅ |
| `tests/engine/agent/prompts-library-snapshot.test.ts` | 删除 | ✅ |
| `docs/plans/architecture/l2-resource-library.md` | 删除 | ✅ |
| `docs/library-format.md` | 删除 (替换为 yaml-format) | ✅ |

### 2.2 新建 brand/ 模块

| 文件 | 功能 | 质量 |
|---|---|---|
| `schema.ts` | zod schema + superRefine 去重 | ✅ 干净 |
| `repository.ts` | 4 表 + seed + effective read + upsert/delete/reset/import | ✅ 与计划 SQL 一致 |
| `loader.ts` | hand-rolled YAML parser/serializer (flow array / block scalar) | ✅ 全面 |
| `types.ts` | BrandType / BrandProfile / EffectiveBrandConfig 两层 | ✅ |
| `default-config.ts` | 三策略 fallback (embedded → fs → literal) | ✅ |
| `index.ts` | 公共 API re-export | ✅ |

### 2.3 HTTP 端点 (routes/brand.ts)

11 个端点全量实现：manifest / types / profiles (GET) + upsert (PUT) + delete (DELETE) + reset (POST) + export (GET) + import (POST) + metadata (GET)。错误体统一 `{ error: { code, message, detail? } }`。✅

### 2.4 默认配置 (public/default-brand/config.yaml)

7 types (朋友圈广告 / 公众号封面 / 小红书图 / 电商详情页 / 活动海报 / DSP 广告 / 产品长图) + 2 profiles (休闲活泼 / 优雅克制)。✅ 与计划一致。

### 2.5 Prompts 清扫

前后端 `system-prompt-marketing.md` + `generated/prompts.ts` 已删除：
- Anchor Component Rules 段
- Validation 段
- 参考区 (library references) 段
- Phase 4 中的 validate 调用
- Phase 2 中 "after any anchor instances" 引用

✅ 清扫彻底。

### 2.6 CI lint

`.github/workflows/no-stale-library.yml` 已加，16 个黑名单关键词，排除 archive/history 目录。✅

### 2.7 CHANGELOG

P3 breaking change 段落完整：Added / Removed / Changed 分区清晰，迁移指南指向新文档。✅

### 2.8 架构文档

- `docs/plans/architecture/l2-brand-config.md` — ✅ 已建，设计理念 / 数据模型 / API / 运行时全覆盖
- `docs/library-yaml-format.md` — ✅ 已建，schema v1 格式文档

---

## 三、问题清单

### P0 — 阻塞编译

#### 3.1 `MarketingLibraryDialog.vue` 未删除

**位置**: `src/components/chat/MarketingLibraryDialog.vue`

**计划要求**: 整文件删除 (计划 §7 文件动作汇总)

**现状**: 文件仍存在 (139 行)，import 了已不存在的 `documentLibraryMismatch` 和 `replaceMarketingLibrary`。`ChatInput.vue:29` 仍 import 并在模板中使用 `<MarketingLibraryDialog>`。

**影响**: 编译报错 — `documentLibraryMismatch` 和 `replaceMarketingLibrary` 在 `library.ts` 中已被删除，import 路径断裂。

**修复**: 删除 `MarketingLibraryDialog.vue`；从 `ChatInput.vue` 移除 import (L29) 和模板引用 (L230)。

#### 3.1a `MarketingConfigBar.vue` import 断裂 — `injectLibraryReferences` / `useInjectedReferenceIds` 已删除

**位置**: `src/components/chat/MarketingConfigBar.vue:21-23`

**现象**: 前端控制台报错：
```
Uncaught SyntaxError: The requested module '/src/app/ai/marketing/library.ts'
does not provide an export named 'injectLibraryReferences'
(at MarketingConfigBar.vue:21:3)
```

**原因**: `MarketingConfigBar.vue` 从 `library.ts` 导入了两个 P3 已删除的函数：

| 导入 | 用途 | P3 后状态 |
|---|---|---|
| `injectLibraryReferences` (L21) | 将 library 参考图注入画布参考区页面 | ❌ 已删除 |
| `useInjectedReferenceIds` (L23) | 响应式跟踪已注入参考图 id 集合 | ❌ 已删除 |

计划 §6.6 要求保留为 no-op shim，但实际代码中被彻底删除，导致模块加载阶段即断裂。

**修复方案 A**: 在 `library.ts` 中为这两个函数保留空壳 shim（`injectLibraryReferences` 返回空结果，`useInjectedReferenceIds` 返回空 Set），待后续 re-wire 到 BrandConfigPanel。
**修复方案 B**: 直接从 `MarketingConfigBar.vue` 移除参考区相关逻辑（如果参考区功能已完全废弃）。

#### 3.1b `openBrandRepository` 启动时 `~/.opencil/` 目录不存在 → SQLITE_CANTOPEN

**位置**: `packages/agent/src/brand/repository.ts:302` + `packages/agent/src/brand/default-config.ts:90`

**现象**: `bun run dev` 启动 agent server 时报：
```
SQLiteError: unable to open database file
  errno: 14, code: "SQLITE_CANTOPEN"
  at new Database (bun:sqlite:260:28)
  at openBrandRepository (repository.ts:302:14)
```

**原因链**:
1. `defaultBrandDbPath()` 返回 `join(process.env.USERPROFILE, '.opencil', 'brand.db')` → `C:\Users\yeqin\.opencil\brand.db`
2. `~/.opencil/` 目录首次运行时不存在
3. `new Database(path, { create: true })` **只创建文件，不创建父目录** — SQLite 不具备 `mkdir -p` 能力
4. 目录不存在时 SQLite 直接报 `SQLITE_CANTOPEN` (errno 14)

**修复**: 在 `openBrandRepository` 中，`new Database()` 调用之前添加 `mkdirSync(dirname(opts.path), { recursive: true })` 确保父目录存在。对 `:memory:` 路径跳过。

#### 3.1c `.opencil` 笔误 — 应为 `.openpencil` (双 p)

**位置**: `packages/agent/src/brand/default-config.ts:91` + 5 个文档文件 (共 14 处)

**现状**: `defaultBrandDbPath()` 返回 `join(home, '.opencil', 'brand.db')`，但整个代码库的命名约定是 **双 p** `openpencil`：

| 位置 | 用法 | 拼写 |
|---|---|---|
| `src/app/automation/mcp/spawn.ts:113` | `~/.openpencil/mcp.json` | ✅ 双 p |
| `desktop/capabilities/default.json` | `openpencil-mcp-http` | ✅ 双 p |
| `src/constants.ts:66` | `TRYSTERO_APP_ID = 'openpencil'` | ✅ 双 p |
| `src/constants.ts:70` | `app.openpencil.dev` | ✅ 双 p |
| P2 计划 | `~/.openpencil/agent-library.db` | ✅ 双 p |
| **P3 `default-config.ts:91`** | **`.opencil`** | **❌ 单 p** |
| **P3 文档 (6 处)** | **`~/.opencil/brand.db`** | **❌ 单 p** |

**影响**: DB 路径与 MCP 配置路径命名空间不一致；用户 HOME 下会出现 `.opencil` 和 `.openpencil` 两个目录，造成混淆。

**修复**: `defaultConfig.ts` 中 `.opencil` → `.openpencil`；同步修正 CHANGELOG.md / library-yaml-format.md / server.ts / types.ts / l2-brand-config.md 中的引用 (共 6 处文档)。

---

### P1 — 功能正确性

#### 3.2 `markMarketingRoot` 双重定义 + 签名不一致

**位置**:
- `packages/core/src/tools/marketing/setup.ts` — 本地函数定义 (无 libraryName 参数)
- `packages/core/src/tools/marketing/restore.ts` — 导出函数 (有 libraryName? 参数)

**现状**: setup.ts 在删除对 restore.ts 的 `markMarketingRoot` import 后，本地重新定义了一个简化版本，不写 `LIBRARY_KEY` marker。而 restore.ts 的版本仍写入 `LIBRARY_KEY`。

**影响**:
- setup 写入的 marker 格式与 restore 读取的格式不一致
- `marketingRootLibrary()` 永远返回 `undefined` (因为 setup 不写 library key)
- `listDocumentLibraryNames()` 永远返回空数组
- library 追踪机制处于半废弃状态：restore 仍导出相关函数，但 setup 不再写入对应数据

**修复方案 A** (推荐 — 彻底废弃 library 追踪): 从 restore.ts 删除 `LIBRARY_KEY` / `marketingRootLibrary` / `listDocumentLibraryNames`；从 marketing.ts 删除 `listDocumentLibraryNames` 导出。
**修复方案 B** (保留兼容): 统一使用 restore.ts 的 `markMarketingRoot`，删除 setup.ts 的本地版本。

#### 3.3 CI grep lint 正则误报严重

**位置**: `.github/workflows/no-stale-library.yml:36`

**现状**: 正则 `\b(anchor|readonly|validate|...)\b` 会匹配：
- TS `readonly` 关键字 (`private readonly db` 在 repository.ts, credentials.ts 等多处)
- `validateSchema` / `validateCredentialValue` 等无关函数
- `validateVectorNetwork` 等场景无关函数

grep 结果显示 packages/ 目录下有大量 `readonly` / `validate` 命中 (均为 TS 语言特性或无关 validate)，CI 会持续误报 fail。

**修复**: 从黑名单正则中移除 `readonly` 和 `validate` (它们是通用 TS 关键字，不应在黑名单里)。或改为只在 `.md` 文件中匹配 marketing 上下文的用法。

---

### P2 — Sweep 完整性

#### 3.4 `src/app/ai/tools/index.ts:122` — validate 残留

```typescript
const MARKETING_ONLY_TOOLS = new Set([
  'look',
  'setup_material_type',
  'validate',   // ← validate 已从 CORE_TOOLS 删除，但这里没清
  'read_brief',
  'create_brief'
])
```

validate 工具已从 `registry-core.ts` 删除，但前端 tools index 的 `MARKETING_ONLY_TOOLS` 仍引用它。虽不影响运行时 (Set 多一个不存在的 key 无害)，但属于 sweep 不彻底。

**修复**: 从 `MARKETING_ONLY_TOOLS` 中移除 `'validate'`。

#### 3.5 `tests/helpers/marketing-types.ts` — AnchorResult 残留

```typescript
export interface AnchorResult {
  template: string
  position: string
  instanceId: string
}
export interface SetupToolResult {
  anchors?: AnchorResult[]
  repaired?: string[]
}
```

`SetupResult` 类型已不再包含 `anchors` 和 `repaired` 字段 (setup.ts 已移除)，但测试 helper 仍保留旧类型定义。`tests/engine/tools/marketing/registry.test.ts:17` 仍使用 `anchors: []`。

**修复**: 删除 `AnchorResult` 接口；从 `SetupToolResult` 移除 `anchors` 和 `repaired` 字段；清理 registry.test.ts 的 `anchors: []`。

#### 3.6 P2 文档未标 superseded

**位置**: `docs/plans/tasks/agent-backend-p2-library-backend.md`

**计划要求**: 标 `docs/plans/tasks/agent-backend-p2-library-backend.md` 为 superseded

**现状**: 文件状态行仍写 `计划待批`，无 superseded 注脚。

**修复**: 在文件头部添加 `> 状态: 已被 P3 (agent-backend-p3-brand-config) 取代`。

#### 3.7 anchor-design-review 未加废弃注脚

**位置**: `docs/review/2026-08-03-anchor-design-review.md`

**计划要求**: 保留 + 加废弃注脚 (说明锚点已废弃)

**现状**: 文件未被修改，仍为原始内容。

**修复**: 在文件头部添加废弃注脚，说明 anchor 机制已在 P3 中移除。

---

### P2+ — 数据资产

#### 3.12 `config.yaml` 丢失 6 个历史 profile (调优资产)

**位置**: `public/default-brand/config.yaml`

**计划要求** (§4 默认内容): "复用当前 default-library.fig 已有的 types/profiles，转换器一次跑过即可"

**现状**: 原 `tools/marketing-library/src/generate.ts` 中定义了 **8 个 profile**，新 config.yaml 仅保留 1 个 (`casual_v1`) 并凭空新增 1 个 (`elegant_v1`)，丢失 6 个：

| 原 profile id | 用途 | config.yaml |
|---|---|---|
| `casual_v1` | 休闲活泼 | ✅ 保留 |
| `watercolor_poster_v0` | 水彩 control group (冻结基线，不可修改) | ❌ 丢失 |
| `watercolor_poster_v1` | 水彩 R0 样板 (Fixed/Variable/Anti-identity 系统) | ❌ 丢失 |
| `editorial_poster_v1` | 杂志封面风 R6 对照组 | ❌ 丢失 |
| `solid_poster_v1` | 扁平几何 R6 对照组 | ❌ 丢失 |
| `watercolor_poster_v1_center_left` | 水彩 center-left lockup 变体 | ❌ 丢失 |
| `watercolor_poster_v2` | 水彩 v2 候选 (量化 shadow/eyebrow/variable hero height) | ❌ 丢失 |
| `watercolor_poster_v3` | 水彩 v3 (中文作者首款 profile) | ❌ 丢失 |
| `elegant_v1` | — | ⚠️ 原库不存在，凭空新造 |

**影响**: 这些 profile 是 Phase 2.5 视觉环境工作流、lockup system (lower-left / center / upper-right)、Anti-identity 规则、hero height variable system 等调优的测试资产。丢失后无法复现 A/B 实验条件，watercolor 系列的 v0→v1→v2→v3 迭代链断裂。

**修复**: 从 `git show HEAD:tools/marketing-library/src/generate.ts` 恢复全部 8 个 profile 的 markdown 内容，转换为 YAML 格式写入 config.yaml。`elegant_v1` 若需保留可作为新增 profile 追加，但不应替代历史 profile。

---

### P2+ — 用户可读性

#### 3.14 `config.yaml` 中 `name: "Acme Brand"` — 用户无法理解的占位名

**位置**: `public/default-brand/config.yaml:2`

**现状**: `name` 字段值为 `"Acme Brand"`。Acme 是英语世界通用的虚构公司名（源自 Road Runner 卡通），中文用户完全无法理解。该值通过 `BrandConfigPanel` UI 和 `effectiveConfig()` API 对用户可见。

**修复**: 改为中文通用名，如 `"默认品牌"` 或 `"我的品牌"`；或考虑在 UI 中不展示 name 字段（它在功能上无实际作用）。

#### 3.15 "品牌配置" (brand config) 命名对用户不友好

**位置**: `BrandConfigPanel.vue` 标题、`l2-brand-config.md` 文档、CHANGELOG

**现状**: P3 将整个机制命名为 "品牌配置" (brand config)，但实际内容是：

| 概念 | 实际含义 | 用户心智模型 |
|---|---|---|
| `types` (素材类型) | 广告素材的格式/尺寸预设 (朋友圈广告 1080×1080, 小红书图 1080×1440...) | "我要做什么尺寸的图" |
| `profiles` (风格档案) | 视觉风格指南 (休闲活泼, 水彩风, 杂志风...) | "我要什么风格" |

"品牌" 暗示这些是品牌专属配置（logo、色板、字体），但实际是 **设计预设/模板**。用户会困惑："我还没设置品牌，能不能先做设计？" — 实际上不需要品牌信息也能使用。

**建议更名方向**:

| 当前命名 | 问题 | 建议替代 |
|---|---|---|
| 品牌配置 (brand config) | 暗示需要品牌信息 | 创意预设 / 设计模板 / 素材方案 |
| BrandConfigPanel | 同上 | PresetPanel / TemplatePanel |
| `brand.db` | 同上 | `presets.db` / `templates.db` |
| `brand_types` / `brand_profiles` | 表名含 brand | `preset_types` / `preset_profiles` |

这是一个 breaking change 级别的命名调整，需要在 P3 合入前决定。如果 P3 先合入再改名，后续迁移成本更高。

---

### P2+ — 提示词基础设施泄露

#### 3.13 `system-prompt-marketing.md` 中 "library" 术语残留 (prompt-overlay 不一致)

**位置**: `packages/agent/src/prompts/system-prompt-marketing.md:55,69` + 前端副本 `src/app/ai/chat/system-prompt-marketing.md:55,69`

**现状**: P3 将 overlay 标题从 `## Material types in the current library` 改为 `## Material types in the current brand`，但 prompt 指令仍引用旧名：

| 行 | prompt 原文 (library) | overlay 实际输出 (brand) |
|---|---|---|
| 55 | "listed below in the section titled **Material types in the current library**" | `## Material types in the current brand` |
| 55 | "the default library failed to load (or the bound library has no Types zone)" | — |
| 55 | "ask the user to reopen the library dialog" | — |
| 69 | "returns the resolved size plus any library warnings" | — |

**影响**: AI 收到 overlay 输出 `## Material types in the current brand`，但 prompt 指引它去找 `## Material types in the current library` — 名称不匹配导致 AI 可能找不到 types 列表，Phase 0 无法正确推断 material type id。

**修复**: 将 prompt 中所有 "library" 替换为 "brand" / "brand config"：`"Material types in the current library"` → `"Material types in the current brand"`；`"default library failed to load"` → `"brand config failed to load"`；`"reopen the library dialog"` → `"check the brand config"`；`"library warnings"` → `"warnings"`。

---

### P3 — 一致性 / 健壮性

#### 3.8 前后端 `buildMarketingOverlay` 签名断裂

**位置**:
- 后端: `packages/agent/src/prompts/library-snapshot.ts` — `buildMarketingOverlay(snapshot: LibrarySnapshot, repo: BrandRepository)`
- 前端: `src/app/ai/marketing/library.ts` — `buildMarketingOverlay(_graph: unknown)`

**现状**: 后端版本从 `snapshot.pickedProfileId` + repo 构建 (只输出 active profile markdown，不输出 types 列表)。前端版本从 `current.value` (shallowRef<EffectiveBrandConfig>) 构建 (输出 "Material types in the current brand" + active profile)。两者输出不再 byte-for-byte identical。

**影响**: Path A (agent backend) 和 Path B (browser-in-process) 会产生不同的 system prompt overlay，可能导致 AI 行为不一致。

#### 3.9 `http-agent-transport.ts` — body 中冗余 types/profiles

```typescript
body.librarySnapshot = {
  userPickedProfileId: pickedProfileId ?? null,
  types: brand.types.map(...),     // ← 后端不消费
  profiles: brand.profiles.map(...) // ← 后端不消费
}
```

后端 `decodeLibrarySnapshot` 虽然解析 types/profiles，但 `buildMarketingOverlay` (后端版) 只读 `snapshot.pickedProfileId`，完全忽略 types/profiles。前端发送这些数据是浪费带宽。

#### 3.10 `repository.ts` `counts()` SQL 拼接

```typescript
const count = (table: string): number =>
  this.db.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0
```

表名直接拼接进 SQL 字符串。当前只内部调用且参数固定，无实际注入风险，但不符合防御性编程惯例。

#### 3.11 多个新文件缺少末尾换行符

以下文件末尾无换行 (`\ No newline at end of file`)：
- `packages/core/src/tools/marketing/setup.ts`
- `packages/core/src/tools/marketing/restore.ts`
- `packages/agent/src/prompts/library-snapshot.ts`
- `src/app/ai/marketing/library.ts`

---

## 四、问题汇总

| 优先级 | # | 位置 | 问题 | 影响 |
|---|---|---|---|---|
| **P0** | 3.1 | MarketingLibraryDialog.vue | 未删除，import 断裂 | 编译报错 |
| **P0** | 3.1a | MarketingConfigBar.vue | injectLibraryReferences/useInjectedReferenceIds 已删除 | 模块加载报错 |
| **P0** | 3.1b | repository.ts / default-config.ts | `~/.opencil/` 目录不存在 → SQLITE_CANTOPEN | 启动崩溃 |
| **P0** | 3.1c | default-config.ts + 6 文档 | `.opencil` 笔误应为 `.openpencil` | 路径命名不一致 |
| **P1** | 3.2 | setup.ts / restore.ts | markMarketingRoot 双重定义 | library 追踪半废弃 |
| **P1** | 3.3 | no-stale-library.yml | grep 正则匹配 TS readonly/validate | CI 持续误报 |
| **P2** | 3.4 | tools/index.ts | validate 残留在 MARKETING_ONLY_TOOLS | sweep 不彻底 |
| **P2** | 3.5 | marketing-types.ts | AnchorResult 残留 | 类型 stale |
| **P2** | 3.6 | p2-library-backend.md | 未标 superseded | 文档过期 |
| **P2** | 3.7 | anchor-design-review.md | 未加废弃注脚 | 文档过期 |
| **P2+** | 3.12 | config.yaml | 丢失 6 个历史 profile (调优资产) | A/B 实验链断裂 |
| **P2+** | 3.13 | system-prompt-marketing.md ×2 | "library" 术语残留导致 prompt-overlay 不一致 | AI 找不到 types 列表 |
| **P2+** | 3.14 | config.yaml | `name: "Acme Brand"` 占位名用户无法理解 | UI 可读性差 |
| **P2+** | 3.15 | 命名体系 | "品牌配置" 对用户不友好，实际是设计预设 | 用户认知偏差 |
| **P3** | 3.8 | library-snapshot.ts / library.ts | overlay 签名不一致 | Path A/B prompt 不同 |
| **P3** | 3.9 | http-agent-transport.ts | body 冗余 types/profiles | 带宽浪费 |
| **P3** | 3.10 | repository.ts | counts() SQL 拼接 | 代码卫生 |
| **P3** | 3.11 | 4 个文件 | 缺少末尾换行 | 代码卫生 |

---

## 五、建议修复顺序

1. **立即**: 修复 3.1 (删除 MarketingLibraryDialog.vue) + 3.1a (MarketingConfigBar import 断裂) + 3.1b (mkdirSync 确保目录存在) + 3.1c (`.opencil` → `.openpencil`) — 解除编译阻塞、启动崩溃、命名不一致
2. **本轮**: 修复 3.2 (统一 markMarketingRoot) + 3.3 (修正 CI 正则)
3. **本轮**: 修复 3.4–3.7 (sweep 扫尾 + 文档标注) + 3.12 (恢复历史 profiles) + 3.13 (prompt "library" → "brand") + 3.14 (Acme Brand → 中文名)
4. **决策**: 3.15 (是否在 P3 合入前将 "品牌" 重命名为 "预设/模板") — 越早决定迁移成本越低
4. **后续**: 修复 3.8–3.11 (一致性 + 代码卫生)
