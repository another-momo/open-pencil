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
| V1 | T28-D1 鉴权全链：server 中间件 401 行为 + vite-plugin token 注入 + standalone token 文件（0o600/只打路径） | 读 auth.ts/server.ts/main.ts/vite-plugin.ts + 起一个 standalone 实例实测 401/200（注意机器安全协议：前台、超时、用后清点孤儿进程） | 待核验 |
| V2 | 直连后端冒烟脚本 token + 401 负向断言覆盖无遗漏 | grep spikes/s-pi/backend-smoke/ 全部自起后端脚本，对照 self-check §2.1 清单逐个确认 | 待核验 |
| V3 | T28-D2 GC 语义：归档移动非删除、index 除条、list/readHistory 语义、失败只 warn | 读 session-gc.ts + service.ts 触发点；复跑 t28/session-gc-smoke.mjs（前台单跑） | 待核验 |
| V4 | T28-D3/D4：format:check = oxfmt --check 同口径；ci.yml pi-backend-contract job 接线正确 | 读 package.json/ci.yml diff；`bun run format:check` 实跑 | 待核验 |
| V5 | T28-D5/D6：57→59 补丁 lastReviewed 全量在位；`check:zones --patches-report` 恒 exit 0；zones 变更报警代码路径 | 脚本核验 zones.json；实跑报告模式；读 check/tasks.ts:304-384 | 待核验 |
| V6 | smoke:pi 五套件复跑全绿 + 零孤儿（机器安全协议：前台逐套件、timeout、每套件后查 bun 进程） | `bun run smoke:pi` 或逐套件；`tasklist //FI "IMAGENAME eq bun.exe"` 前后对比 | 待核验 |
| V7 | **远端 CI 复验（05 附录 B.3 强制）**：推送后 `gh run view <id> -R another-momo/open-pencil` 复验 conclusion，含 pi-backend-contract job 实测绿 | gh run list/view；run id 与 conclusion 记入本表 | 待核验 |
| V8 | 三方一致：plan §2 验收清单 ↔ self-check 实录 ↔ 代码/配置磁盘态 | 逐条对照，偏差即打回 | 待核验 |

## 机器安全硬约束（核验 subagent 必读）

- 冒烟/起服一律前台逐套件跑，单套件 timeout ≤180s；禁止后台跑冒烟
- 每跑完一个套件立即 `tasklist //FI "IMAGENAME eq bun.exe"` 检查，发现 pi-backend 残留立即 `powershell Stop-Process` 清理
- 任何套件超 3 分钟无输出视为挂起：停掉、清孤儿、记受阻，不反复重试

## 核验结论

结论栏待核验 subagent 填写：可以收口 / 打回 + 理由。
