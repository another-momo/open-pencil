<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T66 自检 · T65 回归修整批 + 生图/备份优化提案（owner 2026-09-01）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent A（面板）/B（后端）/C（生图）+ 核验 subagent

plan：docs/rebuild/tasks/T66-plan.md（六项范围 ①②③④⑤⑥ + 内部设施不外露裁定）。

## 1. 实现段核验（2026-09-01 三 subagent 完工报告 + 主 agent 集成实证）

### ① 状态双显收敛（A）

- ChatInput.vue 空槽引导条删除（`chat-empty-slot-hint` + `chipsEmptyHint` 键零残留，grep 实证）。
- ChatContextBar trigger 双段式（模板 :250-262，max-w-44→max-w-80）：空槽「当前设计区：待新建 | 需求单：无」/ 在槽「当前设计区：\<设计名\> | 需求单：\<N\>」；计数口径 = 当前页（`scanCurrentPageBriefs` 当前页口径实证——walk state.currentPageId childIds；跨页 brief 不计入由测试钉扎）。

### ② 需求单大面板 + 排版错乱修复（A）

- **根因修复**：`createBriefOnPage`（active-design.ts:312）收尾四件套——`computeAllLayouts`（core layout.ts:66）+ `store.select` + `zoomToSelection` + undo 登记（snapshotPage/pushUndoEntry，tool-handlers.ts:84-109 同通路）。写回统一走 `applyBriefMutation`（:274，排版结算 + undo + 失败回滚）。
- **ChatBriefDialog.vue 新建**（406 行，核验勘误）：AppDialog 族；素材四能力——上传（useFileDialog → addBriefMaterialEntry，内部 figma.createImage 内容寻址入库）/ 选区添加（复制语义，原节点保留由测试钉扎）/ 删除 / 缩略图（objectURL 缓存 + 关闭 revoke）；内容/标题 @change 提交 + commit-before-act；打开/保存后重读。
- ChatContextBar 需求单段收敛为列表 + 新建入口；条目点击开 dialog；ChatPanel 尾部挂载。
- 测试：tests/engine/rebuild/marketing/chat-brief-panel.test.ts 新建 7 用例（排版结算/select/undo 往返/fieldsHint 落画布/上传入库/undo 回滚/当前页计数）。

### ③ 画布文案（A）

- texts.ts:20 fieldsHint → 「把需求写在这里：要做什么、给谁看、必须出现的内容、素材怎么用——写得越完整，AI 越少猜」；其余 hint 逐一核查非同病，不动。绑定行保留（定谳）。

### ④ 停止链路修复（B）

- service.ts:454 abort 守卫 `if (!entry?.running) return` → `if (!entry) return` + 无条件 `session.abort()`——裁决证据：pi agent.js:202 / agent-session.js:1168 三层 idle abort = 无害 no-op 实证。后端确认日志 :478（console.debug，lint 只允许 warn/error/debug）。
- 测试：service-abort.test.ts 新建 4 用例（run 收尾后 abort 仍送达——旧守卫下零调用的回归钉扎 / 进行中送达 / 未知 session no-op / 抛错吞掉）。
- 记录在案限制：abort 不打断进行中的长 HTTP（generate 240s）——工具层 signal 透传列后续可选方向。

### ⑤ 备份容器迁专用页（B）

- **提案声明证伪**：「findPlacementPosition 已支持任意 page」为假（placement.ts 原实现只读 currentPage）——新增 graph 级跨页 seam `getPageContentBoundsOnPage` / `findPlacementPositionOnPage`（placement.ts:36,56），既有 figma 签名单行委托、现存调用点零改动。
- history.ts：`getOrCreateBackupPage`（:126，pluginData `role=image-history-backup-page` 幂等查找，缺失才 addPage('图片备份')）；createContainer 改走跨页 seam；isMarketingDesignRoot 锚定与死码删除。消费者回归核查：protectedRedirect/references/commitImageGen 全部 page-agnostic（读码实证）。
- 测试：history.test.ts 位置断言改备份页 + 幂等/跨页一致性/统一放置策略 3 新用例；placement-race.test.ts 补 seam 直测。

### ⑥ 生图 provider 优化（C；P0-P5 全落，P6/P7 不做）

- **P0+P1**：presets.ts 物理删除；provider-dmx.ts → provider.ts git mv（createImageGenProvider/ImageGenProviderOptions）；provider-types.ts 新建注册表（`openai-compatible` 一族）；credentials 四字段 {providerType, baseUrl, apiKey, model}（旧格式容忍读、迁移在写）；grep IMAGE_GEN_PRESETS/createDmxImageGenProvider/provider-dmx 代码面零命中。
- **P2**：`POST /api/pi/image-gen/test` 探针（GET {baseUrl}/models，Bearer，15s；缺省字段回落已存凭证，key 不回前端）；settings UI「测试连接」按钮 + 成败回显行。
- **P3**：文生图 JSON 与图生图 multipart 双侧显式 `response_format: 'url'`。
- **P5+P4**：description 3068 → 1962 字符（核验勘误；断言钉 <2000）；参数 schema 化 Type.Array(Type.Object({9 字段}, additionalProperties:false))——框架层 validateToolArguments 拒绝路径实证；JSON 字符串解析保留为兼容降级（裁决：00 仓踩坑语义资产）。
- 测试：tool-contract.test.ts（schema 四类错误 + 长度 + 透传）、routes.test.ts（真 HTTP server）、provider.test.ts（契约全集 + 探针三态）、credentials/orchestration/requests 改写。
- ImageGenKeysSection.vue 文案走 fork i18n seam（owned），zones 零新增（任务书「上流 i18n patch」假设证伪）。

### ⑦ 内部设施不外露（owner 收口期裁定，主 agent 落地）

- generate.ts:59 删「backup page ("图片备份") history container」→「auto-preserved and stays reusable as a reference」；system-prompt-marketing.md:137 同步修正（T66 ⑤ 后旧表述「根框右侧/历史图片备份容器」已过期）→ 功能语义表述（保留/复用/勿清理），不出现页名/容器名。tool-contract 断言不受影响（钉 replace_id/references/ONE call/401/长度）。

## 2. 门禁实测（2026-09-01 集成态，全 unpiped）

| 门禁 | 结果 |
| --- | --- |
| `bun run check:zones` | clean（81 modified / 516 added / 1019 deleted / 0 renamed） |
| `bun run typecheck` | exit 0 |
| `bun run check:i18n` | All locale files are in sync |
| `bun run test:type-shapes` | No duplicate object type shapes |
| `bun run lint` | 0 errors（7 max-lines 警告均既有存量）——集成期修 1 error：client.ts:84 return-await（C 遗漏，主 agent 修） |
| `bun run test:dupes` | 0 clones |
| `bunx oxfmt --check`（触碰文件） | 全绿 |
| SFC 编译扫描（5 个 .vue） | 5/5 OK |
| `bun test ./tests/engine/rebuild` | 375 pass / 0 fail / 30 files |
| `bun run smoke:pi` | exit 0（五套件链） |

## 3. 实测偏差记录

1. 选区添加素材一律复制（无移动/复制选择器——任务书允许的简化，测试钉扎原节点保留）。
2. dialog 写回升级 applyBriefMutation 包裹（素材增删不结算会重现同一排版根因——蓝本同律）。
3. caption 输入用原生 input（AppInput ref 拿组件实例，聚焦会静默失效）；提交改 @change（commit-before-act）。
4. abort 前端 toast 未做（SSE 断连后无带外通路；后端日志在案——前端状态行归后续）。
5. 备份页布局在切页访问时结算（pages.ts 既有模式），桥 mutating 收尾只结算当前页——非回归。
6. C 中断恢复一次（provider 认证故障，API 更换后 resume；恢复后仅 lint 收尾）。

## 4. 遗留

- Playwright 交互实测（双段 trigger/dialog 四能力/停止按钮/备份页）→ W4 T-D 批次。
- system-prompt-marketing.md 全面重写（阶段/CP 口径）→ T67/T68（本次只修泄露与过期句）。
