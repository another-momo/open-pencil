# 品牌配置 (Brand Config)：架构与运行时

> 本文档取代已删除的 `docs/plans/architecture/l2-resource-library.md`。状态与任务进度见 `README.md`；冒烟错误目录见 `../knowledge/error-catalog.md`，实测方法论见 `../knowledge/methodology.md`。

## 1. 设计理念

### 1.1 范式转变

P3 之前：营销设计的"library"是一个**上传替换的静态资源**（`.fig` 二进制文件），用户通过 MarketingLibraryDialog 上传 / 替换。库内的 Types / Profiles / Components / References 都是库作者定义好的纯只读资产。

P3 之后：brand config 是**用户级 CRUD 资产**，出厂预设 + 用户覆写两层结构，存储在本地 SQLite。每次会话自动加载默认 + 用户的合并视图。

### 1.2 解耦原则

非画布数据（types / profiles）与画布节点数据彻底解耦：
- type = `{ id, label, size, description? }` —— 静态元数据
- profile = `{ id, label, applicable_to: string[], markdown }` —— Markdown 风格指南

它们**不再**寄生在 `.fig` 文件里。AI 在画布上创建内容时也不再操作任何"组件实例 / 锚点实例"。

### 1.3 用户体验闭环

| 步骤 | 用户行为 | 系统行为 |
|---|---|---|
| 1 | 首次打开 marketing tab | 加载出厂预设（`public/default-brand/config.yaml` 自动 seed） |
| 2 | 在 BrandConfigPanel 编辑 / 新建 type/profile | 写入用户层（SQLite） |
| 3 | 关掉 app | 数据持久化到 `~/.openpencil/brand.db` |
| 4 | 重新打开 | 用户层 + 默认层合并展示（user 优先） |
| 5 | 导出 | 下载合并视图 YAML |
| 6 | 导入同事文件 | 整库替换用户层（v1 简化，v2 再做 merge） |
| 7 | 重置 | 二次确认后清空用户层，默认层保留 |

## 2. 数据模型

### 2.1 文件格式（YAML）

```yaml
schema_version: 1
name: "默认品牌库"
types:
  - id: wechat_moments
    label: 朋友圈广告
    size: 1080x1080        # 固定尺寸
    description: 微信朋友圈信息流广告
  - id: ecommerce_detail
    label: 电商详情页
    size: 750x              # 末尾 x = HUG（长图）
profiles:
  - id: casual_v1
    label: 休闲活泼
    applicable_to: [wechat_moments, xiaohongshu, product_long]
    markdown: |
      # 休闲活泼风格
      - 主色调: 暖橙 + 奶白
      ...
```

- `size` 格式：`WxH`（固定）或 `Wx`（HUG = 自适应高度）
- `applicable_to`：适用 type id 列表；空数组 = 全部
- `markdown`：自由 Markdown 文本，注入 system prompt overlay

### 2.2 SQLite schema（`~/.openpencil/brand.db`）

```sql
CREATE TABLE brand_default_types (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  size_w INTEGER NOT NULL, size_h INTEGER,
  description TEXT
);
CREATE TABLE brand_default_profiles (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  applicable_to TEXT NOT NULL,  -- JSON array
  markdown TEXT NOT NULL
);
CREATE TABLE brand_user_types (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  size_w INTEGER NOT NULL, size_h INTEGER,
  description TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE brand_user_profiles (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  applicable_to TEXT NOT NULL,
  markdown TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE brand_meta (key TEXT PRIMARY KEY, value TEXT);
```

读取视图（user 优先）：
```sql
SELECT * FROM brand_user_types
UNION ALL
SELECT * FROM brand_default_types
WHERE id NOT IN (SELECT id FROM brand_user_types);
```

### 2.3 默认 brand config

出厂预设 `public/default-brand/config.yaml` ship-with 仓库，agent 进程首次启动时检测 `brand_meta.seed_version`，缺失则从 YAML seed 默认层。

Web 版（无 agent）走 Path B：前端硬编码一份相同的 fallback config。

## 3. API 端点（agent backend）

| Method+Path | 用途 |
|---|---|
| `GET /v1/brand/manifest` | 合并视图（含 effective types + profiles） |
| `GET /v1/brand/types` / `profiles` | 单项列表 |
| `PUT /v1/brand/types/:id` | upsert 用户层 type |
| `DELETE /v1/brand/types/:id` | 删用户层 type（fallback 到 default） |
| `PUT /v1/brand/profiles/:id` | upsert 用户层 profile |
| `DELETE /v1/brand/profiles/:id` | 同上 |
| `POST /v1/brand/reset` | 事务化清空用户层 |
| `GET /v1/brand/export` | 返回合并视图 YAML（attachment） |
| `POST /v1/brand/import` | body=YAML，事务化整库替换用户层 |
| `GET /v1/brand/metadata` | seed_version + counts |

错误格式：`{ error: { code, message, detail? } }`，状态码：400 / 404 / 409 / 500。

## 4. 前端 UI

`src/components/chat/BrandConfigPanel.vue`：4 个 tab（素材类型 / 风格档案 / 导入导出 / 恢复默认）的侧抽屉面板。完整 CRUD 客户端，与 `/v1/brand/*` 1:1 对应。

挂载入口（待 C11 sweep 阶段补）：`MarketingConfigBar.vue` 内添加"品牌配置"按钮。

## 5. runtime 流程

```
用户描述需求
    │
    ├─→ AI 推断素材类型（"做一张朋友圈广告" → wechat_moments）
    │
    ├─→ AI 调用 setup_material_type({id: "wechat_moments"})
    │     · 执行：从 BrandRepository 读 type 配置 → 创建根 frame
    │     · 返回：size + page + adopted
    │     · profile overlay：用户激活 profile 时 Markdown 注入 system prompt
    │
    ├─→ AI 按 prompt 规则执行工作流（Phase 1-4）
    │
    └─→ AI 在每段收尾调用 describe + batch_update 修复问题
```

**已移除机制**：
- ❌ Anchor（component / component-page / materialize / rebuild）—— 删除
- ❌ Validate（anchor_deleted / anchor_misplaced）—— 删除
- ❌ References（cloneSubtreeAcrossGraphs / libraryReferenceId）—— 删除
- ❌ `readonly:` 文本声明 —— 删除
- ❌ `default-library.fig` (176KB) —— 删除
- ❌ `MarketingLibraryDialog.vue` 上传替换 UI —— 隐藏入口（保留组件无 UI 集成）

## 6. 关键不变量

1. **出厂预设只读**：default_* 表永不被应用代码修改；reset / import 只清 user_*。
2. **user 优先**：合并视图永远先取 user，再 fallback 到 default —— 不论修改时间。
3. **导入是整库替换**：v1 简化语义；v2 再考虑 merge 策略。
4. **schema_version 锁**：`{schema_version: 1}` literal，未来加字段必走迁移脚本。
5. **DB 路径**：`~/.openpencil/brand.db`，环境变量 `OPENPENCIL_BRAND_DB` 覆盖；测试环境 fallback `:memory:`。
6. **不向上兼容**：P3 是 breaking change，旧 `.fig` 库加载流程无法回退 —— 历史文档保留在 `docs/plans/history/`。

## 7. 关联文档

- `l2-agent-mode.md` —— 营销 agent 模式（已修订，去掉 §3-§5 旧机制）
- `library-yaml-format.md` —— 品牌配置 YAML 文件格式规范（已替代 `library-format.md`）
- `l2-agent-backend.md` —— agent backend 架构（已更新 `/v1/brand/*` 端点）
- `docs/plans/tasks/agent-backend-p3-library-重构.md` —— P3 实施计划
- `docs/plans/tasks/agent-backend-p2-library-backend.md` —— **superseded by P3**
- `docs/review/2026-08-03-anchor-design-review.md` —— 锚点设计 review，**已废弃**，保留作为历史

## 8. CI 防御

`.github/workflows/no-stale-library.yml` 扫描黑名单关键词（anchor / readonly / validate / cloneSubtreeAcrossGraphs / LibrarySession / LibrarySnapshot / default-library.fig / 参考区 / BrandBar / CTABar / x-op-library-snapshot 等 16 个），命中即 fail PR。历史归档目录（`docs/plans/archive/`、`docs/plans/history/`、`docs/review/2026-08-15-*`、`CHANGELOG*.md`）显式豁免。