<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T66 计划 · Phase 3 W3 追加：T65 回归修整批 + 生图/备份优化提案（owner 2026-09-01）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent ×3 + 核验 subagent
> **决策源**：owner 2026-09-01 两轮反馈（四问 + 双段式 trigger 拍板 + open-pencil 旧分支参考线索）+ 两份优化提案（仓外 docs/202609010000-history-container-placement.md、docs/202609010000-image-gen-provider-review.md）

## 1. 范围与定谳

### ① 状态双显收敛（owner 拍板：双段式 trigger）

- 删 ChatInput.vue:109-115 空槽引导条（`chat-empty-slot-hint` + i18n `chipsEmptyHint`）。
- ChatContextBar trigger 改双段式状态文案，直接承担引导职责：
  - 空槽：`当前设计区：待新建 | 需求单：无`
  - 在槽：`当前设计区：<设计名> | 需求单：<N>`
  - 需求单计数口径 = 当前页（拍板⑩沿用，scanDocumentBriefs 既有扫描）；设计名超长 truncate（现 trigger 已有 max-w-44 + truncate，双段后按需加宽上限）；「待新建/无」用 text-muted 弱色区分视觉权重。
  - trigger 仍单按钮展开同一面板，交互不变。

### ② 需求单大面板重做 + 新建排版错乱修复（owner 四问之 2，最大块）

**根因（读码 + 旧分支对照实证，2026-09-01）**：面板路径与 agent 路径共用同一 core `createBrief`（brief.ts:410 单源），但旧分支（open-pencil worktree，feature/agent-backend）`createBriefInStore` 的收尾是 `computeAllLayouts(store.graph, currentPageId)`（core layout.ts:66 纯图函数）+ select + requestRender + undo 快照；T65 前端路径（active-design.ts:258 `createBriefOnPage`）只有 findPlacementPosition + createBrief + 可选播种——**没有排版结算**，文字节点停在未测量态，auto-layout 折叠/叠块。

**修法**：
- `createBriefOnPage` 收尾补齐旧分支四件套：computeAllLayouts（当前页 scope）→ store.select([briefId]) → 定位展示（zoomToSelection 或等效）→ undo 登记（对齐 tool-handlers.ts:84-86 的 snapshotPage/pushUndoEntry 先例；旧分支 brief-panel.ts:85-102 为蓝本）。
- **详情编辑迁出 popover**：新建 `ChatBriefDialog.vue`（独立大面板，AppDialogRoot/Header/Body 族），以旧分支 BriefPanelDialog.vue（341 行，已存档 /tmp/BriefPanelDialog-old.vue）为蓝本：
  - 素材区四能力补齐：上传图片（useFileDialog → bytes → graph.images 存 hash → core addBriefMaterialEntry {hash}）、从画布选区添加（移动/复制选择器，session 内记忆选择）、素材删除（core removeBriefMaterial 已有）、缩略图（objectURL 缓存 + 关闭/卸载释放，旧实现 :59-78 范式）。
  - 内容区编辑、素材标题编辑沿用现有 saveBriefContent/saveMaterialCaption 通路；草稿态 commit-before-act（@change 提交、@input 只记草稿）。
- ChatContextBar 需求单段收敛为列表 + 当前目标 + 「新建需求单」入口；点击条目 → 打开 ChatBriefDialog（不再 popover 内嵌详情）。
- 画布真相纪律不变：面板零自有事实源，打开/保存后重读。

### ③ 画布需求单文案（owner 四问之 3）

- `texts.ts:20` fieldsHint 改写为引导式（不写死字段）：「把需求写在这里：要做什么、给谁看、必须出现的内容、素材怎么用——写得越完整，AI 越少猜」。同步检查 brief.ts 其他 hint 文案（subtitle/materialsEmptyHint/materialNote/designsEmptyHint）同口径。
- 顶部绑定行（BRIEF_BINDING_LABEL_NAME）：**不删**（设计身份三元组的画布侧可见面，T62 后面板读它），简化未绑定态显示。owner 已认可「不删但简化」方向。

### ④ 停止按钮不停（owner 四问之 4，真 bug）

**断点（链路实证，2026-09-01）**：stop → chat.stop() → fetch abortSignal → host.ts:254 销毁上游 → server.ts:140-143 `res.on('close')` → `service.abort(sessionId)`（service.ts:451）——守卫 `if (!entry?.running) return`，但 `entry.running` 由 runPrompt finally（:379）复位；`res.on('close')` 触发时序上 finally 可能已先跑完（fetch 断开 → SSE 写失败 → run 收尾），abort 被跳过。另 `session.abort()` 对卡在长工具调用（图像生成 HTTP）的 run 取消不即时。

**修法**：
- abort 守卫去 running 布尔依赖：改 run 代际（runSeq 比对）或无条件 `session.abort()`（pi 对 idle session 的 abort 是无害 no-op，service.ts:454 注释自认）。
- abort 后端确认回显（日志 + 前端 toast/状态行），消除「以为停了其实在跑」。
- Playwright 实测验证归 W4 T-D 批次（本任务留探针断言钩子）。

### ⑤ 备份容器迁专用页（提案 P1，仓外 docs/202609010000-history-container-placement.md）

- `packages/core/src/tools/fork/image-gen/history.ts` createContainer：弃「锚定 marketing root 右侧」逻辑，改「查找或创建专用 backup page + 该页内 findPlacementPosition 放置」；删 isMarketingDesignRoot 锚定 import。
- 提案称 placement.ts 的 findPlacementPosition 已支持任意 page——**实现 subagent 须先核实此声明真伪**（读 placement.ts 签名与 page 解析逻辑），若不支持跨页则先补 seam 再迁，并在 self-check 记录裁决证据。
- 回归面：beginImageGen/commitImageGen/恢复读取必须同页一致；history.test.ts 位置断言同步更新；备份机制的消费者（恢复/重用 references）全链核查。
- 文案确认：专用 page 名称（如「图片备份」）随实现定稿记录。

### ⑥ 生图 provider 优化（提案 P2，仓外 docs/202609010000-image-gen-provider-review.md；按建议顺序取前五项，P6/P7 可选不做）

- **P0+P1 合体**：删 `image-gen/presets.ts`；`ImageGenCredentials` 去 presetId 收 `{providerType, baseUrl, apiKey, model}`；`provider-dmx.ts` → `provider.ts` 重命名（函数 createImageGenProvider、接口 ImageGenProviderOptions、注释去 DMX）；`requests.ts:59` 注释更新；`ImageGenKeysSection.vue` preset 下拉 → Provider 类型下拉 + baseUrl/apiKey/model 自由输入 + 测试连接按钮；`client.ts` setImageGenCredential 参数对齐；测试三件套（credentials/orchestration/provider-dmx→provider.test.ts）23 处污染清零。
- **P2 连接测试**：settings UI「测试连接」按钮 → 后端轻量探针（GET {baseUrl}/models 或等效；成败显式回显）。
- **P3**：请求体显式 `response_format: 'url'`。
- **P5 先行（方案 B）**：generate.ts 工具 description 精简至 <2000 字符（提案给范文）。
- **P4 后行（方案 A）**：工具参数从单 JSON 字符串拆为 Type.Array(Type.Object({...9 字段})) 带 schema 校验——注意与 P5 同文件，须一次改到位避免二遍工。
- 红线（提案 §4 不改清单）：双段编排/0o600 凭证存储/超时/错误解析/响应解析不动。
- 兼容裁决：凭证文件旧格式（含 presetId）读到时的迁移/容忍策略由实现 subagent 定并在 self-check 记录（建议容忍读旧字段忽略之，新写不含）。
- **内部设施不外露（owner 2026-09-01 收口期裁定）**：工具 description 与 workflow prompt 不向模型暴露备份页名/容器名等内部落点——只声明「旧版本自动保留、可作 reference 复用」的功能语义。落点：generate.ts GENERATE_IMAGE_DESCRIPTION + system-prompt-marketing.md 备份段（同步修正 T66 ⑤ 后已过期的「根框右侧/历史图片备份容器」旧表述）。

## 2. 领土与门禁

- 落点全在已 owned 区：src/components/chat/（T65 已升 ownedRoot）、packages/core/src/tools/fork/、src/app/ai/pi-backend/、src/app/i18n/fork/、tests/engine/rebuild/、src/components/settings/provider/（ImageGenKeysSection.vue 已 owned）。zones.json 零新增预期。
- i18n：fork panels/chips 命名空间同步（chipsEmptyHint 删除、contextTrigger 双段文案、brief dialog 键组）；ImageGenKeysSection 若用上流 i18n 键走 patch 注册——**先核 ImageGenKeysSection 的文案来源**（ownedFile 直改还是经 packages/vue i18n）。
- 测试：tests/engine/rebuild/ 补 createBriefOnPage 收尾行为用例（排版结算调用、undo 登记）与 abort 守卫用例（run 收尾后 close 事件仍触发 session.abort）；image-gen 测试随 P0-P5 改写。
- 门禁：check:zones / typecheck / check:i18n / type-shapes / lint / dupes / oxfmt / SFC 扫描 / rebuild 单测 / smoke:pi 全绿（unpiped）。

## 3. 不做清单

- brief 结构本体（createBrief 树）不改；schemaVersion 不 bump。
- ChatContextBar 面板的三合一骨架不动（只迁出详情视图）。
- agent 侧 create_brief 工具协议不动。
- 需求单跨页语义（v1 同页限定）不动。
- 提案 P2 的 P6（Seedream provider 新增）/P7（透明背景）本轮不做（提案自标可选；providerType 字段先行落地为 P6 留位）。

## 4. 验收标准

1. 空槽时 UI 只有 ContextBar trigger 一处状态显示，双段文案两态正确；`chat-empty-slot-hint` 与 chipsEmptyHint 键零残留（grep）。
2. 面板新建需求单：画布落点排版与 agent 路径产物结构/布局一致（测试断言 computeAllLayouts 调用 + undo 登记）；ChatBriefDialog 四素材能力可用（单测覆盖 add/remove/caption；上传链路组件级测试或留 W4 e2e）。
3. fieldsHint 新文案落画布（createBrief 产物断言）。
4. abort：run 收尾后客户端断连仍触发 session.abort（单测）；oxlint/typecheck 全绿。
5. 备份容器落专用 page：history 测试全绿，恢复读取同页一致；findPlacementPosition 跨页裁决有据。
6. 生图：presets.ts 物理删除零残留（grep IMAGE_GEN_PRESETS）；provider.ts 重命名后旧名零命中；凭证四字段链路（UI→client→routes→磁盘）测试覆盖；连接测试按钮后端探针单测；description <2000 字符断言；新 schema 下 9 字段校验用例（含四类常见错误：拼错/类型/嵌套/枚举）。
7. 三件套齐 + 核验 PASS 后 flip tracker。
