<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T28-plan.md · T28 决策批代码面整改

> **T 编号**：T28（决策批落地 · 代码面）
> **状态**：✅ 已收口（实施+核实+门禁完成；独立核验见 [T28-verify.md](T28-verify.md)）

## 1. 背景与立项依据

2026-08-25 owner 对三方 review 整改报送清单 15 项逐项拍板（决策批，单一留痕口 = [records/topics/docs-governance.md 决策批总登记](../records/topics/docs-governance.md)）。T28 承载其中**代码面 6 项**，T29 承载**文档面 10 项**。

| 决策批 # | owner 原话 | T28 承载 |
|---|---|---|
| #1 pi 后端零鉴权 | 「按你建议的方式改」 | T28-D1 |
| #2 session GC / rotate | 「按你建议的方式改，归档，不删除」 | T28-D2 |
| #5 补丁白名单加固（lastReviewed/过堂） | 「同意建议」 | T28-D5（机制） |
| #6 zones.json 自我修订报警 | 「同意建议」 | T28-D6（机制） |
| #10 format:check 净树判据 | 「同意建议」 | T28-D3 |
| #12 测试体系（只优化 pi-backend） | 「只优化 pi-backend 测试，其他交上游」 | T28-D4 |

本文件为收口时补写的立项文档：实施期方案以主 agent 两份 subagent 任务书（实施 + 核实续跑）为准，六项设计决策（T28-D1..D6）在任务书中完整定义，本文件 §3 收录定稿口径。

## 2. 验收清单

- C1 T28-D1 鉴权全链落地：vite-plugin token 注入 + proxy 补头 + server 中间件（/health 豁免、定常比较、fail-close）+ standalone 自生成 token 文件（0o600、只打路径）+ 全部直连后端冒烟脚本带 token 与 401 负向断言
- C2 T28-D2 session GC 落地：超龄/超量**移动归档**（不删除）+ list/readHistory 语义 + GC 失败只 warn + t28/session-gc-smoke.mjs 覆盖
- C3 T28-D3 format:check 改 `oxfmt --check`（与 format 同路径集）+ ci.yml 引用同步
- C4 T28-D4 契约测试进 CI：smoke 套件自含化（合成 fixture）+ ci.yml pi-backend-contract job 跑 `bun run smoke:pi`
- C5 T28-D5/D6 机制落地：zones.json 全部补丁带 lastReviewed + `check:zones --patches-report` 报告模式；zones.json 变更 commit 无 task 指针即 fail + P 条目摘要输出
- C6 门禁全绿 + smoke:pi 逐套件实录（前台单跑、每套件后孤儿进程检查）+ 远端 CI rebuild/pi 全绿（05 附录 B.3：gh run view 复验）

## 3. 设计决策定稿（Tk-Dn 口径，决策批 #7 后首个适用任务）

### T28-D1 pi 后端 bearer 鉴权

- vite-plugin 每 vite 进程生成一枚 32-hex 随机 token：spawn 时 env `OPENPENCIL_PI_TOKEN` 注入子进程（崩溃复活沿用同枚），proxy 对 `/api/pi` 统一注入 `Authorization: Bearer` 头
- server.ts 中间件：sha256 摘要 + `timingSafeEqual` 定常比较；`/health` 豁免（CI/探活需要）；无 token（standalone 直跑且无 env）时 fail-close 全拒
- standalone 模式自生成 token 写 `<cwd>/.openpencil/pi-backend-token`（0o600、tmp+rename 原子、控制台只打路径不打值）
- token 文件适用 key 卫生同级纪律：不打印、不入库、不外传
- 直连后端的冒烟脚本一律带 token + 每条 401 负向断言；共用 helper `pi-backend-auth.mjs`

### T28-D2 session GC（归档不删除）

- 双规则：超龄（`OPENPENCIL_SESSION_MAX_AGE_DAYS`，默认 30 天）或超量（`OPENPENCIL_MAX_SESSIONS`，默认 200，最老先归至阈值内）
- 动作 = **移动**到 `.openpencil/pi-sessions-archive/`（保文件名、index.json 除条、archive 内无索引）——owner 拍板「归档，不删除」
- `listSessionFamily` 只扫 index 不扫 archive；`readHistory` 对已归档会话返回空
- GC 失败只 warn 不阻断主流程；触发点 = 铸新会话后 + runPrompt 收尾

### T28-D3 format:check 判据换源

- `format:check` 由「format 写后 git status 判净树」改 `oxfmt --check`（与 format 逐字同路径集）；CI Verify formatting 步骤引用 `bun run format:check` 自动随新口径

### T28-D4 pi-backend 契约测试进 CI

- 冒烟自含化：history/sessions/session-gc 用 tempRoot + `pi-session-fixture.mjs` 合成 fixture（pi v3 JSONL），免 key/浏览器/7600 桥/dev server
- ci.yml 新增 `pi-backend-contract` job 跑 `bun run smoke:pi`；smoke:pi 批次纳入 t28/session-gc-smoke.mjs（五套件）

### T28-D5 补丁 lastReviewed + 过堂报告

- zones.json 全部补丁携带 `"lastReviewed": "YYYY-MM-DD"`（本批登记 = 2026-08-25）
- 报告模式 `bun run check:zones --patches-report`：逐补丁 numstat 摘要 + lastReviewed 日期，恒 exit 0 不判红（供过堂对账）

### T28-D6 zones.json 变更报警

- diff（相对 --base）含 zones.json 时：check:tasks 先输出 P 条目「新增/移除/改动」id 摘要（不判红），HEAD commit message 无 `task: T<NN>` 指针即 fail
- `[no-task-plan]` 豁免对 zones.json 变更**无效**

## 4. 实施与核实分工实录

1. 第一 subagent 实施六项至「门禁+smoke」阶段后失活（2026-08-25）
2. 期间多次被打断的冒烟在 owner 机器累积 20 个孤儿 pi-backend 进程致机器卡死；主 agent 全部清理并实测 sessions-smoke 单跑 14/14 零孤儿，确立机器安全协议（前台逐套件 + 每套件后孤儿清点）
3. 第二 subagent 盘点核实：六项全部「完整」级；补漏两类——check.ts/tasks.ts oxfmt 格式化；**实锤 t24/prompt-assembly-smoke.mjs win32 清理段泄漏孙进程**（`kill('SIGTERM')` 只杀 bun wrapper，孙进程服务器成孤儿——机器卡死根因），改 win32 先行 `taskkill /pid /T /F` 整树杀，同型修复 t21/admin-smoke.mjs 与 tool-smoke.mjs；复跑 t24 29/29 绿零孤儿
