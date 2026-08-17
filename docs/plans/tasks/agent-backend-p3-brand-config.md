# Task: P3 — Brand Config 化(Library 解耦 + 用户级持久化)

> 日期:2026-08-17
> 状态:实施中(未提交)
> 依据:`.zcode/plans/plan-sess_ee20ef4f-7bf4-4e88-8172-5b0bdddcf807.md`(已批准的 P3 计划)+ 用户对 "library 资源浪费" 与 "sweep 不彻底" 的反馈
> 范围:`packages/agent/src/brand/**`、`packages/agent/src/routes/brand.ts`、`packages/agent/src/{agent-loop.ts,routes/chat.ts,server.ts,prompts/**}`、`packages/core/src/tools/{marketing/**,marketing.ts,index.ts,registry-core.ts,image-gen/apply.ts}`、`src/app/ai/{chat/**,marketing/**}`、`src/components/chat/{BrandConfigPanel.vue,MarketingConfigBar.vue,ChatInput.vue,ProfileGalleryDialog.vue}`、`public/default-brand/**`、`tests/engine/{agent,tools,app,helpers}/**`、`.github/workflows/no-stale-library.yml`、`docs/**`
> 不在本轮范围:导入 merge(v2 再做, v1 整库替换)、PATCH 端点(只有 upsert)、多 library 并存、Path B(browser agent)的 brand config 读取(仍用前端默认)、`setup_material_type` 工具下沉

范式转变:从「library = 上传替换的静态资源」→「brand config = 用户级 CRUD 资产」。

## 1. 产品体验闭环(用户视角)

| 步骤 | 用户行为 | 系统行为 |
|---|---|---|
| 1 | 首次打开 marketing tab | 出厂预设(复用 default-library.fig 现有 types/profiles) |
| 2 | 「新建 type」填表 | INSERT user 层,chip 立即刷新 |
| 3 | 编辑 default type 字段 | user 层加 override 行 |
| 4 | 新建 profile + markdown | INSERT user 层 |
| 5 | 关掉 app | DB 持久化到 `~/.openpencil/brand.db` |
| 6 | 重新打开 | user 层与 default 合并展示(user 优先) |
| 7 | 导出 | 下载合并视图 YAML |
| 8 | 导入同事文件 | **整库替换** user 层(v1 简化,v2 再做 merge) |
| 9 | 重置 | 二次确认后清 user 层,default 不动 |

## 2. 已锁决策(8 条)

1. 持久化位置:SQLite on agent service(`~/.openpencil/brand.db`)
2. 出厂预设不可变;user 覆盖;reset 清 user 层
3. **导入**:整库替换(事务化);**导出**:合并视图
4. 存储底格式:YAML + zod schema 校验
5. anchor + validate + components + references **全删**
6. **不兼容 breaking change**(不维护向上兼容)
7. **T8 sweep commit + CI grep lint rule + T11 二次 sweep** 三道防线
8. 历史档案不动:CHANGELOG 历史 / `docs/plans/history/` / `docs/plans/archive/` / `docs/review/2026-08-15-agent-backend-branch-review.md`;**`docs/plans/architecture/l2-resource-library.md` 删文件 + git 痕迹保留**

## 3. Sweep 审计(用户特别强调)

黑名单关键词:`anchor` / `readonly` / `validate` / `components page` / `references page` / `参考区` / `cloneSubtreeAcrossGraphs` / `library session` / `LibrarySession` / `LibrarySnapshot` / `serializeLibrarySnapshot` / `x-op-library-snapshot` / `library warnings` / `default-library.fig` / `BrandBar` / `CTABar`

预计 ~300 行 × 40 文件命中。CI 加 `.github/workflows/no-stale-library.yml`:grep 黑名单全 repo,命中即 fail PR。

## 4. 数据模型

**YAML(导入导出)**:
```yaml
schema_version: 1
name: "Acme Brand"
types:
  - { id: wechat_moments, label: 朋友圈广告, size: 1080x1080, description: 微信朋友圈信息流广告 }
profiles:
  - id: casual_v1
    label: 休闲活泼
    applicable_to: [wechat_moments, xiaohongshu]
    markdown: |
      # 休闲活泼风格
      ...
```

**SQLite schema(`~/.openpencil/brand.db`)**:
```sql
CREATE TABLE brand_default_types (id PRIMARY KEY, label, size_w, size_h, description);
CREATE TABLE brand_default_profiles (id PRIMARY KEY, label, applicable_to, markdown);
CREATE TABLE brand_user_types (id PRIMARY KEY, label, size_w, size_h, description, updated_at);
CREATE TABLE brand_user_profiles (id PRIMARY KEY, label, applicable_to, markdown, updated_at);
CREATE TABLE brand_meta (key PRIMARY KEY, value);
-- seed 后写入 {key='seed_version', value='1'}
```

**有效读取**:`brand_user_types UNION ALL brand_default_types WHERE id NOT IN user`(user 优先)。types / profiles 视图各一个 `effective_*` VIEW。

**默认内容**:复用当前 `default-library.fig` 已有的 types/profiles,转换器一次跑过即可。

## 5. API 端点(`packages/agent/src/routes/brand.ts`)

| Method+Path | 用途 |
|---|---|
| `GET /v1/brand/manifest` | 合并视图(含 activeProfileId) |
| `GET /v1/brand/types` / `profiles` | 单项列表 |
| `PUT /v1/brand/types/:id` | upsert(用户层) |
| `DELETE /v1/brand/types/:id` | 删用户层 |
| `PUT /v1/brand/profiles/:id` | upsert |
| `DELETE /v1/brand/profiles/:id` | 同上 |
| `POST /v1/brand/reset` | 事务清空 user_* |
| `GET /v1/brand/export` | 返回合并 YAML |
| `POST /v1/brand/import` | body=yaml,事务替换 user_* |
| `GET /v1/brand/metadata` | seed_version / db_path / counts |

PUT 全用 upsert,无 PATCH。错误统一 `{ error: { code, message, field? } }`。

## 6. 实施计划(11 commits / 12 工作日)

| # | Commit | 工时 |
|---|---|---|
| 1 | `feat(marketing): add BrandConfig YAML loader (zod schema)` | 1d |
| 2 | `chore(marketing): drop anchor + readonly + validate + references machinery` | 2d |
| 3 | `chore(marketing): ship default-brand/config.yaml, drop default-library.fig` | 0.5d |
| 4 | `feat(agent): add BrandRepository (SQLite + 4 tables + seed)` | 1d |
| 5 | `feat(agent): add /v1/brand endpoints (CRUD + reset + import/export)` | 1.5d |
| 6 | `feat(chat): add BrandConfigPanel UI for in-place brand config management` | 2d |
| 7 | `refactor(chat): agent-loop reads brand config from DB, no more snapshot` | 1d |
| 8 | `refactor(prompts): sweep stale anchor/validate/readonly from system prompts, tool descriptions, UI strings` ⚠️ | 1.5d |
| 9 | `docs(architecture): rewrite library docs as brand-config docs; sweep stale references` | 1d |
| 10 | `test(marketing): full brand config CRUD + e2e smoke` | 1d |
| 11 | `docs(changelog): P3 entries + final sweep` | 0.5d |

**T8 关键动作**:
- `system-prompt-marketing.md`(前后端 2 份):删参考区段 / anchor 物化规则 / validate 段 / anchor 短语
- `setup_material_type` 描述改"creates root frame",不再提 anchor
- `validate` 工具整段删除
- `MarketingLibraryDialog.vue` 删除
- `tools/index.ts` allowlist 删 `validate`
- `bun tools/inline-prompts` 重跑生成 `prompts.ts`
- `.github/workflows/no-stale-library.yml` 加 grep lint rule

## 7. 文件动作汇总

**整文件删除(10 个)**:
- `packages/core/src/tools/marketing/clone.ts`
- `packages/core/src/tools/marketing/validate.ts`
- `packages/core/src/tools/marketing/library.ts`
- `packages/agent/src/prompts/library-snapshot.ts`
- `public/default-library.fig`
- `tools/marketing-library/src/generate.ts` + tests
- `tests/helpers/marketing-library.ts`
- `tests/engine/tools/marketing/{library,validate,clone}.test.ts`
- `tests/engine/app/marketing-library.test.ts`
- `tests/engine/agent/prompts-library-snapshot.test.ts`
- `src/components/chat/MarketingLibraryDialog.vue`
- `docs/plans/architecture/l2-resource-library.md`

**简化(~15 个)**:`restore.ts` / `setup.ts` / `marketing.ts` / `registry.ts` / `agent-loop.ts` / `routes/chat.ts` / `server.ts` / `image-gen/apply.ts` / frontend `library.ts` / `http-agent-transport.ts` / `MarketingConfigBar.vue` / `ChatInput.vue` / `dialogs.ts` i18n / `tools/index.ts` / `settings.ts`

**新建(~10 个)**:`brand-config.ts` + `brand-config-types.ts`(zod)/ `brand-repo.ts`(SQLite)/ `routes/brand.ts` / `BrandConfigPanel.vue` + 5 edit dialog / frontend `brand-config.ts` / `tools/brand-config/src/generate-yaml.ts` / `public/default-brand/config.yaml` / `.github/workflows/no-stale-library.yml`

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Web 版无 agent → 无法用 brand config | `probeAgentBackend` 失败显示提示,Path B 用前端硬编码默认 |
| Sweep 不彻底(用户重点关切) | T8 sweep + CI grep lint + T11 二次 sweep |
| `generated/prompts.ts` 漂移 | T8 重跑 `bun tools/inline-prompts` |
| i18n 残留 | T8 + T10 e2e 验证 |
| 测试 fixture 残留旧 keyword | T8 grep + T10 全套验证 |
| reset 误操作 | UI 二次确认 + DB 软删(user_* 表加 `deleted_at` 列,30 天后清理) |
| User id 与 default id 冲突 | DB 视图 user 优先;API `409` on create 重复 id |
| `marketingRootLibrary` marker 语义变更 | 仍记录"哪份 brand config 物化",跨 session 恢复用 |

## 9. 与 P2 的关系

P2 全部工作被 P3 吸收:`BrandRepository` = `LibraryRepository` 改名扩 scope;`/v1/brand/*` = `/v1/library/*` superset;T7 = P2 transport 改造。`docs/plans/tasks/agent-backend-p2-library-backend.md` 标 superseded。

## 10. 失败回滚策略

C1-C3 独立可回退(feature flag 关闭);C4-C5 一次性 commit,回退则 reset 到 C3;C6-C7 端到端依赖强,回退则整体 reset 到 C3 重做。

## 11. 关联文档变更

- 删 `docs/plans/architecture/l2-resource-library.md`
- 新建 `docs/plans/architecture/l2-brand-config.md`
- 删 `docs/library-format.md` → 新建 `docs/library-yaml-format.md`
- 修订 `docs/plans/architecture/l2-agent-mode.md`(去掉 §3-§5 旧机制描述,替换为 brand config)
- 标 `docs/plans/tasks/agent-backend-p2-library-backend.md` 为 superseded
- `docs/review/2026-08-03-anchor-design-review.md` 保留 + 加废弃注脚(说明锚点已废弃)
- `docs/review/2026-08-15-agent-backend-branch-review.md` 不动
- `CHANGELOG.md` P3 段落:列出 breaking change、迁移步骤、指向 `l2-brand-config.md`
