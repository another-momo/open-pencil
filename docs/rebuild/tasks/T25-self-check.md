<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T25-self-check.md · T25 自查记录

> **T 编号**：T25（Phase 1-pi 实施 · 减法收口）
> **状态**：🔄 立项（recon 完成，待实施）

## 1. 立项依据

T24-plan D9 拆分 + T24 收口后 Phase 1-pi 任务面唯一剩余项。owner 2026-08-24 拍板 D1-D3（harness 切 / 旧设置面切 / 门退役 + 一键启动）并指令开工。

## 2. 侦察事实（2026-08-24）

1. 三路径实况：pi override（attach.ts:22 env 门）/ ToolLoop（transports.ts:63-110）/ harness（transports.ts:156-183）汇入同一 Chat 类（use.ts:46 createChatSessionManager）
2. vite.config.ts:35 实证：piBackendPlugin 已无条件随 serve 拉起后端——一键启动缺的只是 `server.open` 与 key 自助注入
3. .gitignore:82 实证 `.openpencil/` 不入库——key-env 自助注入无泄露面
4. packages/harness 消费者仅 src/app/ai/harness/{process,transport}.ts（grep -rln 实证）；package.json:16 workspace + lint/format 脚本引用需同步去
5. vision-runtime.ts / tools/vision.ts 零消费者（grep 实证）——look 旧前端实现是死代码，C4a 重建走后端（答疑结论）
6. analyzeAttachedImages（ChatPanel.vue:279）是旧 vision 直通唯一活消费者——随 D2 切除，C4a 恢复（owner 知情）
7. 门消费面：attach.ts:22、use.ts:37、storage.ts:44、ChatPanel.vue:173、ChatInput.vue:82、ModelsPanel.vue:14
8. D2 文件族（grep -rln 'ai/chat/storage|ai/models|ai/providers' 实证 15 文件）：chat/storage.ts、models/{runtime,store}.ts、providers/{registry,compatible}.ts、chat/model.ts、vision-runtime.ts、tools/vision.ts、attachment/image/analyze.ts、settings/credentials/persistence.ts 等 + 组件 ChatProfileSelect/RoleAssignments/ProfileEditor/ProviderSetup
9. 冒烟维护教训（2026-08-24 补跑实证）：固定端口冒烟跑前须查孤儿（netstat 端口实证）；浏览器冒烟必须 node 跑；keeper 页面可自开（tools-smoke.mjs:112-127 模式）

## 3. 实施记录

（实施期回填：3.1 实施事实 / 3.2 与计划的偏差 / 3.3 已知边界）
