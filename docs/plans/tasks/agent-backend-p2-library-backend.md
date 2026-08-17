# Task: P2 — library 后端化(砍 snapshot 传输)

> 日期:2026-08-17
> 状态:**SUPERSEDED** by `agent-backend-p3-brand-config.md` (P3)
> 依据:`docs/plans/architecture/l2-agent-backend.md` §6.3 + 用户对 "library 资源浪费" 的反馈
> 范围:`packages/agent/src/{routes/library.ts,store/library-repo.ts,agent-loop.ts,routes/chat.ts,prompts/library-snapshot.ts}`、`packages/core/src/tools/marketing/library.ts`、`src/app/ai/chat/http-agent-transport.ts`、`src/app/ai/marketing/library.ts`、`tests/engine/agent/**`、`packages/agent/package.json`(+ SQLite 依赖)
> 不在本轮范围:`setup_material_type` / `injectLibraryReferences` 工具下沉、跨 graph clone 工具开发、library 编辑 UI 重做、components / references 的 LLM 直调(本身也不允许)

> **2026-08-17 P3 supersession notice**: P3 took a larger scope than P2 — it deleted anchor / readonly / validate / references machinery entirely, replaced Library .fig with a YAML brand config, and persisted user overrides in SQLite at `~/.openpencil/brand.db`. P2's "library repo + REST endpoints" idea is preserved in spirit but the file/format is now `public/default-brand/config.yaml` + `BrandRepository` (4 tables: default / user types + profiles + meta). See `l2-brand-config.md` for the actual architecture; P2 as written is not implemented.

## 背景与目标

P1 把 chat 走通后,library 仍有 3 处真实浪费:

1. **前端 SceneGraph 常驻** — library.graph 在浏览器内存(1-10MB),只为 `setup_material_type` / `injectLibraryReferences` 两个工具服务
2. **每次 chat 时 serializeLibrarySnapshot** — 前端 walk 整库 → JSON → 发给 agent,每次 chat 几百 KB request body
3. **agent 端 system prompt 拼接** — 每次 chat 重 walk types + profiles + references 元数据

实际使用洞察:**LLM 只用 types + profiles.markdown + hasReferencesPage 三样东西拼 system prompt**(`buildMarketingOverlay`),components / references 的 nodeId 只在 `setup_material_type` / `injectLibraryReferences` 工具内部用,**不给 LLM**。

所以 P2 收缩为:**把"LLM 看到的 library 元数据"和"工具用的 library SceneGraph"解耦**。前者用 DB,后者保留前端 in-memory SceneGraph 不动。

## 4 个明确不动的事

1. **`setup_material_type` 工具实现** — 仍在前端,仍用 library.graph 做 `cloneSubtreeAcrossGraphs`
2. **`injectLibraryReferences` 工具实现** — 同上
3. **library.graph 在前端常驻** — 这两个工具需要它,无法 lazy 化(除非工具下沉,那是 P3)
4. **`buildMarketingOverlay` 行为** — 拼 system prompt 的输出**必须** byte-for-byte 一致

## 真正变的 5 件事

1. **LibraryIndex 数据化** — types / profiles / references meta(不含 nodeId)落到 SQLite
2. **agent 端加 `/v1/library/manifest`** — 返回 types + profiles + references 元数据(userPickedProfileId 不属于 manifest,是 chat 时前端发的 body 字段)
3. **agent 端 system prompt 不再读 librarySnapshot** — 改为直查 DB 拼 prompt
4. **chat 请求不再带 librarySnapshot** — 前端不再 walk graph
5. **profile markdown 来源统一为 DB** — `buildMarketingOverlay` 改为读 DB

## 总览

| 模块 | 工作量 | 提交粒度 |
|---|---|---|
| T1 — SQLite + LibraryRepository + Schema | 1d | 1 commit |
| T2 — `/v1/library/replace` + `/v1/library/manifest` | 1d | 1 commit |
| T3 — agent-loop 改读 DB + buildMarketingOverlay 抽象 | 0.5d | 1 commit |
| T4 — 前端 http-agent-transport 不再发 snapshot | 0.5d | 1 commit |
| T5 — 测试 + docs + CHANGELOG | 1d | 1 commit |

总计 ~4 工作日,按提交顺序逐 PR review。

---

## T1 — SQLite + LibraryRepository

**为什么**: 把 LibraryIndex 从 in-memory SceneGraph 拆出来作为数据形态。

**做什么**:

1. **加依赖**: `bun:sqlite`(Bun 内置,无外部依赖)
2. **新建 `packages/agent/src/store/library-repo.ts`**:
   - schema:
     ```sql
     CREATE TABLE IF NOT EXISTS libraries (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       fig_bytes BLOB,           -- 原始 .fig bytes,debug / re-parse 用
       uploaded_at INTEGER NOT NULL
     );
     CREATE TABLE IF NOT EXISTS library_types (
       library_id TEXT NOT NULL,
       id TEXT NOT NULL,
       label TEXT NOT NULL,
       description TEXT,
       PRIMARY KEY (library_id, id),
       FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS library_profiles (
       library_id TEXT NOT NULL,
       id TEXT NOT NULL,
       label TEXT NOT NULL,
       applicable_to TEXT NOT NULL,  -- JSON array
       markdown TEXT NOT NULL,
       PRIMARY KEY (library_id, id),
       FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS library_references (
       library_id TEXT NOT NULL,
       id TEXT NOT NULL,
       name TEXT NOT NULL,
       applicable_to TEXT NOT NULL,  -- JSON array
       PRIMARY KEY (library_id, id),
       FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
     );
     -- 活跃 library(单例)
     CREATE TABLE IF NOT EXISTS active_library (
       id INTEGER PRIMARY KEY CHECK (id = 1),
       library_id TEXT NOT NULL,
       FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
     );
     ```
   - API:
     ```ts
     class LibraryRepository {
       replaceLibrary(name: string, figBytes: Uint8Array, index: LibraryIndex): Promise<{ libraryId: string }>
       getActiveManifest(): Promise<{ types, profiles, references } | null>
       getActiveProfileMarkdown(profileId: string): Promise<string | null>
       setActiveLibrary(libraryId: string): Promise<void>
       clear(): Promise<void>  // tests
     }
     ```
   - **不做** nodeId / SceneGraph 序列化(用得太少)
3. **打开方式**:
   - 默认路径 `~/.openpencil/agent-library.db`(platform-aware)
   - `OPENPENCIL_AGENT_LIBRARY_DB` env override
   - `:memory:` for tests
4. **测试**: `tests/engine/agent/library-repo.test.ts` — CRUD + active library + cascade delete

**不做**: 不实现 multi-user / 权限 / 审计字段(单机场景)。

---

## T2 — `/v1/library/replace` + `/v1/library/manifest`

**为什么**: 前端替换 library 时,不再把 bytes 留在前端,而是 push 给 agent 一次性 parse + 入库。

**做什么**:

1. **新建 `packages/agent/src/routes/library.ts`**:
   - `POST /v1/library/replace`:
     - body: `{ name: string, figBytesBase64: string }`
     - agent 用 `io.readDocument` 一次性 parse → LibraryIndex → 入库 + setActiveLibrary
     - 返回 `{ ok: true, libraryId, types: number, profiles: number, references: number }`
     - **parse 完丢弃 SceneGraph**
   - `GET /v1/library/manifest`:
     - 返回 `{ types: [...], profiles: [...], references: [...] }`(不含 figBytes)
     - 用于前端 UI 渲染(chip / dialog)
   - `DELETE /v1/library`:
     - 清 active library(回到 default-library.fig?前端决定)
2. **首次启动 seed**: agent 启动时,如果 active_library 为空 → 读 `public/default-library.fig` → parse → 入库。这步是为了让"用户没传 library 也能用"。
3. **测试**:
   - `tests/engine/agent/routes-library.test.ts` — POST / GET / DELETE
   - 验证 seed 行为
   - 验证 replace 后 manifest 变化

**不做**: 不做"上传 .fig 时同时保留在前端"(用户要换 library 时,前端可以从 manifest 反推,但**当前 .fig 字节**由 agent 持久化,不再回传前端)。

---

## T3 — agent-loop 改读 DB + buildMarketingOverlay 抽象

**为什么**: agent-loop 不再依赖 `librarySnapshot` 参数,改为直查 DB。

**做什么**:

1. **`buildMarketingOverlay` 重构**:
   - 输入从 `LibrarySnapshot` 改为 `{ types, profiles, hasReferencesPage, userPickedProfileId }`(等价 shape,但不需要 walk graph)
   - 输出 system prompt **必须** byte-for-byte 跟现在一样
2. **`agent-loop.ts` 改**:
   - `createAgent` 不再接收 `librarySnapshot` 参数
   - `prepareCall` 里:`chatMode === 'marketing'` 时,直查 `LibraryRepository.getActiveManifest()` + 从 body 的 `agent.pickedProfileId` 拿 active profile
3. **`userPickedProfileId` 流向**: 前端在 chat request body 里发(`agent.pickedProfileId` 字段),agent 不存(因为是 user-level UI state,不是 library state)
4. **测试**:
   - `tests/engine/agent/agent-loop.test.ts` — buildMarketingOverlay 输出与现状一致
   - 端到端 chat flow:替换 library → 看 prompt 内容

**不做**: 不动 `LibrarySnapshot` 类型定义(向后兼容 1 个 release,删 deprecated 标记)。

---

## T4 — 前端 http-agent-transport 不再发 snapshot

**为什么**: chat 请求体从几百 KB → 几 KB。

**做什么**:

1. **`src/app/ai/chat/http-agent-transport.ts`**:
   - 删 `serializeLibrarySnapshot(store.graph)` 调用
   - 删 `body.librarySnapshot = snapshot` 行
   - 在 `agent` config 里加 `pickedProfileId: profileSelection.value?.id ?? null`(chatMode === 'marketing' 时)
2. **`src/app/ai/marketing/library.ts`**:
   - 新增 `syncLibraryToBackend()` 函数 — 调 `POST /v1/library/replace`
   - `replaceMarketingLibrary` 调 `syncLibraryToBackend()` 同步给 agent
   - `ensureMarketingLibrary` 首次 load 时也 sync
3. **测试**:
   - `tests/engine/chat/http-agent-transport.test.ts` — 验证 body 不含 librarySnapshot
   - `tests/engine/chat/library-sync.test.ts` — 验证 replace 后 agent manifest 变化

**不做**: 不动 Path B(browser agent)的 library flow,Path B 仍用前端 in-memory SceneGraph。

---

## T5 — 测试 + docs + CHANGELOG

**为什么**: 守护 + 文档。

**做什么**:

1. **测试覆盖**:
   - `tests/engine/agent/library-repo.test.ts` — T1
   - `tests/engine/agent/routes-library.test.ts` — T2
   - `tests/engine/agent/agent-loop.test.ts` — T3(新加 buildMarketingOverlay 对比测试)
   - `tests/engine/chat/library-sync.test.ts` — T4
2. **文档**:
   - `packages/agent/README.md` — 新增 `/v1/library/*` endpoints
   - `docs/plans/architecture/l2-agent-backend.md` §6.3 — P2 状态表
   - `CHANGELOG.md` Unreleased — 新增 5 条 P2 entries
3. **CI**: `bun run test:unit` 通过 + `bun run check` 通过

---

## 提交策略

按 T1-T5 各一个 commit:

1. **`feat(agent): add SQLite LibraryRepository for marketing library`**(T1)
2. **`feat(agent): add /v1/library endpoints (replace, manifest)`**(T2)
3. **`refactor(agent): agent-loop reads library from DB, not snapshot`**(T3)
4. **`feat(chat): http-agent-transport stops sending librarySnapshot`**(T4)
5. **`test(agent): P2 library backend + docs(agent): P2 changelog`**(T5)

每个 commit 前必须 `bun run check` + `bun run test:unit` 通过。

---

## 风险

| 风险 | 缓解 |
|---|---|
| SQLite 在 Windows CI 上有 native binding 问题 | `bun:sqlite` 是 Bun 内置,无 native binding。验证 Windows CI 通过即可。 |
| agent 重启后 active_library 丢失 | SQLite 持久化文件,重启不丢 |
| default-library.fig seed 失败 | 启动时 log warning,不阻塞 agent 启动。GET /v1/library/manifest 返回 404 → 前端 fallback 到 default-library.fig 上传 |
| buildMarketingOverlay 输出与现状不一致 | T3 加 byte-for-byte 对比测试,把现状输出快照存 fixture |
| Path B 兼容性 | Path B 完全不动,仍用前端 in-memory SceneGraph。chat 路径在 transport 层分流 |

---

## 工时估算

| 模块 | 工时 |
|---|---|
| T1 SQLite + Repository | 1d |
| T2 /v1/library endpoints | 1d |
| T3 agent-loop 改读 DB | 0.5d |
| T4 前端停止 snapshot | 0.5d |
| T5 测试 + docs | 1d |
| **总计** | **~4 工作日** |

按每天一个 commit 节奏,最快 4 天交付。

---

## 关联文档

- `docs/plans/architecture/l2-agent-backend.md` — P0/P1 设计,本任务在 §6.3 P2 落地
- `docs/plans/architecture/l2-agent-mode.md` — Agent 模式本身的语义、流程、约束
- `docs/plans/architecture/l2-resource-library.md` — Library 设计理念(整体)
- `packages/core/src/tools/marketing/library.ts` — LibrarySession 现状
- `src/app/ai/marketing/library.ts` — 前端 library session service
- `packages/agent/src/prompts/library-snapshot.ts` — 现状 LibrarySnapshot shape

---

## 决策点(已拍板)

1. **DB 路径**: `~/.openpencil/agent-library.db` — 跟 keychain 一致,用户级资源,不属于任何项目。可以用 `OPENPENCIL_AGENT_LIBRARY_DB` env override。
2. **figBytes 是否入库**: 入库 — 占空间小(1-10MB / library),保留 re-parse 的应急出口,debug 时方便。
3. **default-library.fig seed 时机**: agent 启动时 — 启动失败早发现,marketing chat 第一次就 ready-to-use。
4. **userPickedProfileId 流向**: body 字段 `agent.pickedProfileId` — profile 是 "agent behavior configuration"(跟 `chatMode` 平级),放进 agent config 里更对称。
