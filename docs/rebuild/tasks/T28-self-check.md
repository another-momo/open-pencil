<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T28-self-check.md · T28 自查记录

> **T 编号**：T28（决策批落地 · 代码面）
> **状态**：✅ 已收口（C1-C6 本地面全过；远端 CI 待推送后回填；独立核验见 [T28-verify.md](T28-verify.md)）

## 1. 承诺 / 落地 / 偏差

| 承诺（plan §2） | 落地 | 偏差 |
|---|---|---|
| C1 鉴权全链 | 全链落地（§2.1） | 无 |
| C2 session GC | 落地（§2.2），t28 冒烟 19/19 | 无 |
| C3 format:check 换判据 | 落地（§2.3） | 无 |
| C4 契约测试进 CI | 落地（§2.4），五套件自含 | 无 |
| C5 lastReviewed + zones 报警 | 落地（§2.5/§2.6），57/57 补丁带日期 | 无 |
| C6 门禁 + smoke + 远端 CI | 门禁 10 项 + oxfmt 全绿；smoke:pi 80 断言全绿零孤儿；check:zones 收口期转绿 | 远端 CI 待推送回填（流程性偏差，非缺口） |

**计划外产出（实证发现）**：t24/prompt-assembly-smoke.mjs win32 清理段泄漏后端孙进程（机器卡死根因）——修复并同型对齐 t21/admin-smoke.mjs、tool-smoke.mjs（§2.7）。

## 2. 分项实录

### 2.1 T28-D1 鉴权（C1）【事实】

- `src/app/ai/pi-backend/auth.ts:19-34`：sha256 摘要 + `timingSafeEqual` 定常比较；expected 为空 fail-close 全拒（:28）
- `server.ts:293-302`：`/health` 豁免在先，其余端点未带/带错 token 一律 401（响应不含提示内容）
- `main.ts:58-74`：env 注入优先；standalone 自生成 32-hex 写 `<cwd>/.openpencil/pi-backend-token`（0o600、tmp+rename 原子、控制台只打路径）
- `vite-plugin.ts:38,113,150-156`：每 vite 进程一枚随机 token，spawn env `OPENPENCIL_PI_TOKEN` 注入（崩溃复活沿用同枚），proxy `/api/pi` 统一补 `Authorization` 头
- 直连后端冒烟脚本 6 个全部带 token + 401 负向断言：t21/admin（:102-112，另含非 win32 0600 权限断言）、t22/history（:172-179）、t23/sessions（:189-196）、t24/prompt-assembly（:189-199，双后端双 token 互不相同）、tool-smoke（:234-246）、t28/session-gc（:182-187）；共用 helper `pi-backend-auth.mjs:11-17`
- 改动列表外脚本逐一判定**无需 token**（核实 subagent 逐文件核）：t22/target-smoke（进程内直驱不起后端）、smoke.mjs/recovery-probe.mjs（走 dev server proxy 自动补头）、各 bind/browser 冒烟（proxy 或 playwright route 拦截）；t21/settings-smoke.mjs:80-89 唯一一处直连 7700 已改走 1420 proxy

### 2.2 T28-D2 session GC（C2）【事实】

- `session-gc.ts`（新，92 行）：超龄（`OPENPENCIL_SESSION_MAX_AGE_DAYS`=30）+ 超量（`OPENPENCIL_MAX_SESSIONS`=200，最老先归）双规则；rename 移动保文件名；index 按 basename 除条；单文件失败 warn 跳过
- `service.ts`：目录/env 解析（:115-118）；collectGarbage 失败只 warn（:152-168）；触发点①铸新会话后（:269-270）②runPrompt 收尾（:358-359）；readHistory 归档走 index miss 返回空（:373-377）；listSessionFamily 只扫 index（:395-405）
- 实证：`t28/session-gc-smoke.mjs` 19/19 绿——A 相数量规则 5>3 归最老 2 条、B 相年龄规则 40 天 backdate 单归、archive 无索引、list/readHistory 语义、401 负向（2026-08-25 核实 subagent 前台单跑）

### 2.3 T28-D3 format:check（C3）【事实】

- `package.json:29` 改 `oxfmt --check` 原路径集（与 `format` 逐字同口径，含 `.storybook/`、`scene-graph/scripts/` 等全集）
- `ci.yml:36-37` Verify formatting 引用 `bun run format:check` 自动随新口径，无需另改

### 2.4 T28-D4 契约测试进 CI（C4）【事实】

- `pi-session-fixture.mjs` = 合成 fixture 构造器（pi v3 JSONL，覆盖 user/assistant/thinking/toolCall/toolResult 消费面），被 history/sessions/session-gc 三套件使用；target-smoke 进程内自含、prompt-assembly tempRoot 自含——五套件全自含
- `ci.yml:133-147` 新增 `pi-backend-contract` job 跑 `bun run smoke:pi`；`package.json:60` smoke:pi 已纳入 t28/session-gc-smoke.mjs（五套件）

### 2.5 T28-D5 lastReviewed + 过堂报告（C5）【事实】

- zones.json **57/57** patches 全部 `"lastReviewed": "2026-08-25"`（脚本核验零缺失零错日期）
- 报告模式 `check.ts:158-186`（patchesReport）+ :200-202 早退分支：实测 exit 0，输出逐补丁 numstat 摘要（总计 +1245/-4257 across 57）+ lastReviewed 日期
- 命令：`bun run check:zones --patches-report`（已回填 05-process.md §3.3 标记位）

### 2.6 T28-D6 zones.json 变更报警（C5）【事实】

- `check/tasks.ts:304-328`（id 集合对比摘要：新增/移除/改动）、:330-344（无 task 指针即 `zones-change-task-pointer` violation）、:356-384（先于大改动判定、不受 `[no-task-plan]` 豁免）
- CI 调用链 = rebuild-discipline job → `tasks.ts --base "$BASE"`（ci.yml:130）
- 实测当前工作树：摘要输出「新增 P57；改动 P1…P56」+ HEAD 含 task 指针放行 exit 0
- 命令：`bun run check:tasks`（已回填 05-process.md §3.2 标记位）

### 2.7 计划外：win32 冒烟孤儿根因修复【事实】

- 机理（核实 subagent 最小探针复现）：Windows 上 `bun run` 是 wrapper+孙进程两段，`kill('SIGTERM')` 只杀 wrapper（信号致死 exitCode 恒 null，「exitCode===null 再升级 taskkill」判据对死 wrapper 无效），孙进程服务器成孤儿
- 实证：跑 t24 后实获 2 个孤儿（pid 9244/19988）；修复后复跑 29/29 绿零孤儿
- 修复：t24/prompt-assembly-smoke.mjs 清理段（:339-369）改 win32 先行 `taskkill /pid /T /F` 整树杀，对齐 t22/t23/t28 既有口径；同型修复 t21/admin-smoke.mjs（:219-236）、tool-smoke.mjs（:284-302）——后两者不在 smoke:pi 批次、需真 key/桥，仅 `node --check` 语法验证（改动面仅限 finally 清理段，与已实证修复同模式）
- 与 owner 机器卡死事件的因果关系：此前中断的 subagent 冒烟累积 20 个孤儿（主 agent 已全清）；本修复消除再发源

## 3. 门禁实录（C6，2026-08-25 核实 subagent 前台逐项）

| 门禁 | 结果 |
|---|---|
| tsgo --noEmit | ✅ exit 0 |
| bun run lint | ✅ 0 errors（3 个 max-lines 警告全是上游 packages 既有文件） |
| bun run check:zones | ✅（收口前 2 条预留态 = AGENTS.md/README.md 待登记，主 agent 收口登记 P58/P59 后 `clean: 53 modified (all registered)` 转绿） |
| bun run check:i18n / check:arch / test:type-shapes / test:tools / check:deps / check:monorepo | ✅ 全绿 |
| oxfmt --check（format 口径全集 2020 文件） | ✅（修复 check.ts/tasks.ts 格式后） |

smoke:pi 逐套件实录（前台单跑、每套件后 `tasklist //FI "IMAGENAME eq bun.exe"` 查孤儿）：

| 套件 | 断言 | 孤儿 |
|---|---|---|
| t22/target-smoke | 6 passed, 0 failed | 0 |
| t22/history-smoke | 12 passed, 0 failed | 0 |
| t23/sessions-smoke | 14 passed, 0 failed | 0 |
| t24/prompt-assembly-smoke | 29 passed, 0 failed | 修复后 0 |
| t28/session-gc-smoke | 19 passed, 0 failed | 0 |

合计 **80 断言全绿**；终检零 bun 残留进程、1420/7600/77xx/79xx 端口全空闲。

## 4. 三区登记

- zones.json：P57（ci.yml pi-backend-contract job，第一 subagent 登记）+ P17 注记（package.json）——核实无误；spikes/ 与 tools/zone-registry/ 在 ownedRoots 内无需新 patch
- 待主 agent 收口：P58（README.md）/ P59（AGENTS.md）——决策批 #14 根文档改动，T29 面登记
- check:zones 收口期实测转绿（`[zones] clean: 53 modified (all registered)`，2026-08-25）

## 5. 遗留与边界【事实】

- t21/admin-smoke 与 tool-smoke 的清理段修复未实跑（需真 LLM key/7600 桥/dev server，不在 smoke:pi 批次）；仅语法校验
- D6 负向路径（无 task 指针 → fail）未做破坏性实跑（需伪造 commit）；代码路径已核（tasks.ts:336-343 正则不匹配即返回 violation）
- 全程未读/打印任何 key/token 值；token 文件适用 key 卫生同级纪律
