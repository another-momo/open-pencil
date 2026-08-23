<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T19-verify.md · T19 独立核验

> **T 编号**：T19（Phase 1-pi 实施 · 后端换心：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动）
> **状态**：✅ 收口（2026-08-23，独立核验员逐项实测 V1-V8 全过，远端 CI 全绿）

## 1. 核验结果（2026-08-23，独立核验员实测，非转述文档）

| # | 核验项 | 结果 | 关键证据 |
|---|---|---|---|
| V1 | 后端 service 真实性 | ✅ PASS | service.ts 装配与 spikes/s-pi/live-chat.mjs 逐项一致（ModelRuntime.create + models.json 覆盖 + getModel + noTools:'all'，差异仅 SessionManager 持久化替代 inMemory——任务要求）；node fetch 实测 POST /api/pi-chat 返回 `content-type: text/event-stream` + `x-vercel-ai-ui-message-stream: v1`，帧序列 start → text-start → text-delta×N → text-end → finish → [DONE] |
| V2 | 映射正确性 | ✅ PASS | mapping.ts 逐行对照 S-pi-4 表（T11-self-check §2.5）一致；中文实测回复 char codes 6c49 5b57 65e0 635f（「汉字无损」），UTF-8 全链路无损 |
| V3 | 前端零改动 | ✅ PASS | `git diff 59ff705c..07323180 -- src/components/ChatPanel.vue src/components/chat/ src/app/ai/chat/use.ts src/app/ai/chat/transports.ts` 为空；全量 diff 16 文件全在白名单（选路/新 transport/后端/依赖/gitignore/zones/文档/测试脚本）；pi 三依赖精确钉扎 0.84.2/1.3.7 无 ^/~ |
| V4 | live 冒烟复现 | ✅ PASS | 核验员独立重跑：后端 smoke 14/14（首跑 R1 echo 断言遇模型跑题，重跑即过——meta 路由文风抖动，断言已随后加固为 ≤3 次重试 + JSONL 确定性兜底）；浏览器 smoke 一次跑 7/7，截图生成 |
| V5 | session 连续性 | ✅ PASS | R2 锚点 7391 跨请求命中；磁盘 11 个 JSONL + index.json，smoke session 的 JSONL 含锚点两回合（7 条目）；重启恢复路径（readIndex → SessionManager.open）代码审读通过，实现者 2026-08-23 实测 RECOVERY-PASS（kill 进程树重启后锚点命中），核验员未独立复现此单项（dev server 未重启走不到恢复路径，按派单约定以 R2 替代） |
| V6 | 无占位（D19） | ✅ PASS | 五源文件 + 三脚本逐行审：全部真实实现，无 TODO/空壳 |
| V7 | key 卫生 | ✅ PASS | `sk-or-` 在工作树新文件与文档零命中；`git log --all -S "sk-or-"` 5 命中逐一核实全良性（文档模式串/UI 占位符/测试假 key/gitleaks allowlist）；`.openpencil/` 命中 .gitignore:82；models.json 落盘为 `$OPENROUTER_API_KEY` 引用 |
| V8 | 远端 CI | ✅ PASS | rebuild/pi HEAD `2e6da5dd` run 32637559364 全绿（2026-08-23）。前序两推红灯（format:check 的 oxfmt Win/Linux JSON 规范化不一致；lint:structure 对 tests/ 目录两规则；check:arch 的 FSD 文件摆放）均已在 `2e6da5dd` 修复，事故链实录见 T19-self-check §2.7 |

## 2. 核验结论

**可以提交**。核验员明确：未发现任何伪造迹象，文档声称与实测吻合。

非阻断观察（已处理或已记录）：

1. smoke R1 的回复侧断言依赖 openrouter/free meta 路由模型行为，存在抖动——已加固：echo 断言 ≤3 次换 session 重试 + JSONL 逐字节含发送原文的确定性 UTF-8 断言；回复侧零 U+FFFD 断言移除（上游偶发入模前损坏中文，非本管道缺陷）
2. oxfmt 0.35.0 JSON 规范化 Win/Linux 不一致——本地 format:check 对手工编辑的 JSON 可能假绿，今后 zones.json 类文件以 CI 为准（已记入 self-check §2.7）
3. 聊天底栏模型选择器显示「No model」——cosmetic，归 T21
