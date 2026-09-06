<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
  - 本文件由独立核验 subagent 填写（05-process.md §4.11 + 附录 B）；主 agent 只建骨架
  - 附录 B.3：verify 必须含 `gh run view <id>` 复验远端 CI 结论，缺失即打回
-->

# tasks/T28-verify.md · T28 独立核验

> **T 编号**：T28（决策批落地 · 代码面）
> **状态**：🔄 待独立核验（骨架已建，待 subagent 实跑填写）

## 核验依据

- 方案：[T28-plan.md](T28-plan.md)（六项决策批 + T28-D1..D6 定稿）
- 自查：[T28-self-check.md](T28-self-check.md)
- 规则文：[05-process.md §3.2 zones.json 变更报警 + §3.3 补丁过堂](../05-process.md)

## 核验项（subagent 逐项实跑填写结论 + 证据）

| # | 核验项 | 方法建议 | 结论 |
|---|---|---|---|
| V1 | T28-D1 鉴权全链：server 中间件 401 行为 + vite-plugin token 注入 + standalone token 文件（0o600/只打路径） | 读 auth.ts/server.ts/main.ts/vite-plugin.ts + 起一个 standalone 实例实测 401/200（注意机器安全协议：前台、超时、用后清点孤儿进程） | ✅（2026-08-25）：auth.ts:19-34 sha256 摘要+`timingSafeEqual`、expected 空 fail-close（:28）；server.ts `/health` 豁免在先、其余未带/带错 token 一律 401；main.ts:58-74 env 优先、standalone 自生成 32-hex 写 `<cwd>/.openpencil/pi-backend-token`（0o600、tmp+rename、控制台只打路径）；vite-plugin.ts:38 生成/:113 env 注入/:155 proxy 补头。standalone 实测（`OPENPENCIL_PI_BACKEND_PORT=7799 bun run src/app/ai/pi-backend/main.ts` + curl）：`/health` 无 token=200、`/api/pi/providers` 无 token=401、错 token=401、对 token=405（鉴权已过、方法不允许）；启动日志只打 token 文件路径未打本体。用后整树清理，`tasklist //FI "IMAGENAME eq bun.exe"` 零残留、7799 端口释放 |
| V2 | 直连后端冒烟脚本 token + 401 负向断言覆盖无遗漏 | grep spikes/s-pi/backend-smoke/ 全部自起后端脚本，对照 self-check §2.1 清单逐个确认 | ✅（2026-08-25，grep 逐文件核）：六个直连脚本 401 负向断言全部在案——t21/admin-smoke.mjs:110-112、t22/history-smoke.mjs:174-176、t23/sessions-smoke.mjs:192-194、t24/prompt-assembly-smoke.mjs:197-199（另 :193-194 断言双后端 token 文件可读且互不相同）、tool-smoke.mjs:244、t28/session-gc-smoke.mjs:185-187；共用 helper `pi-backend-auth.mjs:11-17` 只读 token 文件构造头、不打印。改动列表外脚本判定成立：t22/target-smoke.mjs 无 fetch/spawn（进程内直驱不起后端）、smoke.mjs:14 与 recovery-probe.mjs:11 走 1420 dev server proxy、browser-smoke/browser-tool-smoke 走 1420+playwright；t21/settings-smoke.mjs:21 base 默认 `http://localhost:1420`（:80 注释明示直连 7700 已改走 proxy） |
| V3 | T28-D2 GC 语义：归档移动非删除、index 除条、list/readHistory 语义、失败只 warn | 读 session-gc.ts + service.ts 触发点；复跑 t28/session-gc-smoke.mjs（前台单跑） | ✅（2026-08-25）：session-gc.ts（92 行）`renameSync` 移动保文件名（:64）、index 按 basename 重建除条（:79-89）、单文件失败 warn 跳过（:66-72）、archive 不建索引；service.ts:115-118 目录/env 解析、:152-168 collectGarbage try/catch 失败只 warn、:269-270 触发点①铸新会话后、:358-359 触发点②runPrompt 收尾、:373-377 readHistory index miss 返回空、:395-405 listSessionFamily 只扫 index。复跑 `bun spikes/s-pi/backend-smoke/t28/session-gc-smoke.mjs`：19 passed / 0 failed / exit 0（A 相数量规则+B 相年龄规则+archive 无索引+list/readHistory 语义+401 负向全覆盖）；跑后 `tasklist //FI "IMAGENAME eq bun.exe"` 零残留、7266 端口释放 |
| V4 | T28-D3/D4：format:check = oxfmt --check 同口径；ci.yml pi-backend-contract job 接线正确 | 读 package.json/ci.yml diff；`bun run format:check` 实跑 | ✅（2026-08-25）：package.json:29 `format:check` = `oxfmt --check` 与 :28 `format`（`oxfmt --write`）逐字同路径集；ci.yml:36-37 Verify formatting 引用 `bun run format:check` 自动随新口径；ci.yml:133-149 `pi-backend-contract` job（timeout 15min、ubuntu-latest、setup-bun 后 `bun run smoke:pi`）。`bun run format:check` 实测 exit 0（「All matched files use the correct format」，2020 文件，与 self-check §3 口径一致） |
| V5 | T28-D5/D6：57→59 补丁 lastReviewed 全量在位；`check:zones --patches-report` 恒 exit 0；zones 变更报警代码路径 | 脚本核验 zones.json；实跑报告模式；读 check/tasks.ts:304-384 | ✅（2026-08-25）：node 脚本核验 zones.json——59/59 补丁 `lastReviewed` 全在位且全为 2026-08-25（零缺失零错日期；self-check 时 57/57，主 agent 收口新增 P58/P59 同日期）。`bun run check:zones --patches-report` 实测 exit 0，逐补丁 numstat 摘要 + `reviewed=` 日期（总计 +1251/-4257 across 59——self-check 录 +1245/-4257 across 57 + P58/P59 新增 +6/-0，账平）。check.ts:158-186 patchesReport + 报告模式先行早退 exit 0。tasks.ts:304-328 id 集合对比摘要（新增/移除/改动）、:330-344 无 task 指针即 `zones-change-task-pointer` violation、:356-384 先于大改动判定且不受 `[no-task-plan]` 豁免；实测 `bun tools/zone-registry/src/check/tasks.ts --base 08b4129a` 输出「新增 P57, P58, P59；改动 P1…P56」+ HEAD 含 `task: T29` 指针放行 exit 0。CI 调用链 = rebuild-discipline job → `tasks.ts --base "$BASE"`（ci.yml:126-131） |
| V6 | smoke:pi 五套件复跑全绿 + 零孤儿（机器安全协议：前台逐套件、timeout、每套件后查 bun 进程） | `bun run smoke:pi` 或逐套件；`tasklist //FI "IMAGENAME eq bun.exe"` 前后对比 | ✅（2026-08-25 前台逐套件单跑，每条独立调用、跑后即查）：t22/target-smoke 6/6、t22/history-smoke 12/12、t23/sessions-smoke 14/14、t24/prompt-assembly-smoke 29/29、t28/session-gc-smoke 19/19——合计 **80 断言全绿**，各套件 exit 0；每套件后 `tasklist //FI "IMAGENAME eq bun.exe"` 均零残留（五查五零），与 self-check §3 实录一致 |
| V7 | **远端 CI 复验（05 附录 B.3 强制）**：推送后 `gh run view <id> -R another-momo/open-pencil` 复验 conclusion，含 pi-backend-contract job 实测绿 | gh run list/view；run id 与 conclusion 记入本表 | ✅（2026-08-25）：`gh run view 32831596110 -R another-momo/open-pencil --json status,conclusion,headSha,headBranch` = rebuild/pi 分支、headSha `df908884e7134e2b3a71d727c22f15b267489676`（与本地 HEAD `df908884` 一致）、status=completed、**conclusion=success**；`--json jobs` 复验 14 个 job 全 success，含「pi backend contract (smoke:pi)」与「Rebuild discipline」。同 SHA staging run `gh run view 32831236127`（rebuild/pi-staging）亦 completed/success——两 run 同 SHA 互证 |
| V8 | 三方一致：plan §2 验收清单 ↔ self-check 实录 ↔ 代码/配置磁盘态 | 逐条对照，偏差即打回 | ✅（2026-08-25）：plan §2 C1-C6 ↔ self-check §2.1-2.7 ↔ 磁盘态逐条对齐——C1/C2 经 V1-V3 读码+实测复核、C3/C4 经 V4 实跑复核、C5 经 V5 脚本+实跑复核、C6 经 V4/V6 本地门禁与 smoke 复跑 + V7 远端复验复核；补充实测 `bun run check:zones` exit 0（`clean: 53 modified (all registered), 268 added (owned), 1014 deleted (all registered)`）与 `bun run check:docs` 39/39（2026-08-25），与 self-check §3/§4 收口实录一致。self-check §5 自述边界（t21/tool-smoke 仅语法校验、D6 负向未破坏性实跑）如实标注，非隐瞒。未发现三方偏差 |

## 机器安全硬约束（核验 subagent 必读）

- 冒烟/起服一律前台逐套件跑，单套件 timeout ≤180s；禁止后台跑冒烟
- 每跑完一个套件立即 `tasklist //FI "IMAGENAME eq bun.exe"` 检查，发现 pi-backend 残留立即 `powershell Stop-Process` 清理
- 任何套件超 3 分钟无输出视为挂起：停掉、清孤儿、记受阻，不反复重试

## 核验结论

**可以收口**（核验人：独立核验 subagent，非实施者；2026-08-25）——V1-V8 全 ✅：鉴权/GC/format:check/CI 接线/zones 机制六项代码面均经读码 + 实跑复核，smoke:pi 五套件 80 断言复跑全绿零孤儿，远端 CI rebuild/pi run 32831596110（df908884）经 `gh run view` 独立复验 success 且 pi backend contract job 实测绿（05 附录 B.3 口径）。

机器安全实录（如实登记）：V1 standalone 实测时 Git Bash 后台启动的 `bun run` 为 wrapper+孙进程两段，`taskkill //pid $!` 只命中已退 wrapper，服务端 bun.exe（pid 4256）一度残留监听 7799——与 T28-self-check §2.7 记录的 win32 孤儿机理同一现象；当即按机器安全协议 `powershell Stop-Process` 定向清理，`tasklist` 复查零残留、端口释放。此后五套件冒烟均由脚本自带整树清理，五查五零。全程未读/打印任何 key/token 值；tests/fixtures 下 LFS 文件未触碰；本文件之外未改任何文件。

观察项（不打回、供下一任务顺手处理）：T29 面 01-target-state.md §3 修订注记内「smoke:pi 批次现状 59 断言（t22 6+t22 12+t23 14+t24 27）」已随同日先行的 T28 落地过时——现 package.json `smoke:pi` 为五套件（含 t28/session-gc）、本核验实测 80 断言（6+12+14+29+19）；该句自带核验命令（`grep '"smoke:pi"' package.json`）可复现此偏差，详见 T29-verify.md V6。
