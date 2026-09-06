# T76 自检 · S4 §7 尾巴清单刷新（T-E1 可离线部分）

> 日期：2026-09-02。实施 = 主 agent。对照 T76-plan §1/§2。

## 1. 交付（父仓 doc/S4-phase3-plan.md §7，均已 grep 读回）

### 闭合四行（✅ + 删除线，证据含 文件:行号）

1. **active_design 事件④绑定口径**：实证 `active-design-host.ts`
   `formDesignByFormId` :334 / `observeToolExecution` :378 /
   `resolveFormAnswer` :345/:395 在案——与行述「宿主按 run 上下文 + formId
   相关性推导，工具签名不加字段」逐字吻合。
2. **prompt-overlay.ts / modes.ts T24 遗留**：实证 prompt-overlay.ts:5-6
   头注「material types 段整段 + T24 遗留（setup_material_type fallback
   文案）一并删除」；`ls src/app/ai/chat/` 无 modes.ts；
   `grep -rn setup_material_type src/ packages/core/src` 仅命中该头注
   （自述删除），零活引用。
3. **GHOST 窗口规则分层**：T64 ✅ 在 tracker；实证
   `.github/workflows/upstream-drift.yml:8-9` schedule cron '17 1 * * *'。
4. **image_gen_begin/commit 对 AI 可见性**（T54 I2）：T72 闭合——
   internal-visibility.test.ts 钉 agent 工具集不透出 + MCP 注册面过滤 +
   ALL_TOOLS 保留（桥执行面），2026-09-02 复跑 5/5 绿。

### 进展注记一行

5. **base 双源收编**：组装侧已读注册表（active-design-host.ts:114
   `registry.base?.body`；`grep system-prompt-base src/` 零运行时引用）；
   退役半项未执行——tools/rebuild/src/verify/t46-base-fidelity.mjs:2-58 仍
   钉双源逐字一致，退役需 owner 裁决（删文件 + 退脚本）。

### 新登记六行

6-11. v3 derive_palette 死链（P1-02 待 owner 裁决）/ abort 长 HTTP（P2-01）/
   routes 4xx i18n（P2-02）/ 桥 health 假阳性 + RPC wedge（T73-A）/ 工具变更
   落不可见 store（T73-B，疑同源）/ res.on('close') proxy 语义后路（T73 根因，
   带外通道已补位）。

## 2. 门禁（unpiped，2026-09-02）

- `bun run check:docs` → 44/44；`bun run check:zones` → clean。
- 零代码变更：lint/tsgo/format/i18n 不适用（沿用 T75 收口时全绿态，
  本任务无新触及文件）。
- 全量测试本机不跑（owner 2026-09-02 指示）。

## 3. 偏差

1. 本任务不构成 T-E1 完全收口——「Phase 3 验收执行 + 阶段门翻 ✅」仍阻塞于
   W4 冒烟（等 owner 配 OpenRouter + dmxapi key）。
2. 未触碰其余未闭合行（web 资产兜底 / 全自动档 / multi-segment / prefix
   缓存实测 / 创意生图专题 / base 重设计 / casual_v1 / editorial-solid /
   hero_composition / MCP-headless catalog / 软终止观察 / 表单 e2e /
   已知降级 / 上游 i18n / look elision / T59 观察项）——均阻塞于 owner
   裁决或 W4，原文不动。
3. 新登记第 10 行（不可见 store）含「疑同源」推断成分，已在行内明示为
   疑似、并给出反例（T73 钱测健康会话 12 圆全部正常落布）。
