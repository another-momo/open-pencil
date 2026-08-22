<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T13-verify.md · T13 核验（subagent 实做）

> **T 编号**：T13（Phase 1-X 收口 · D22 拍板后）
> **核验人**：独立 subagent（只读 + 可执行重跑），2026-08-22
> **被核验文档**：[T13-self-check.md](T13-self-check.md)
> **结论**：**可以提交**（初判「需修正后提交」，F1–F3 已全部就地修正；主干 A/C/D 组全 ✅）

## 1. 核验结论表

| 项 | 结论 | 依据 |
|---|---|---|
| A · 合并拓扑 | ✅ | `git log --oneline -4`：918b048c merge(T11) → 694f4a29 merge(T12) → 29d560be D22；远端 `gh api repos/another-momo/open-pencil/branches/rebuild/v2 --jq .commit.sha` = 918b048c（git 数据端口黑洞，未跑 fetch，gh api 实证） |
| A · CI 叙事 | ✅ | run 32563228158 conclusion=success 且 Rebuild discipline job=success；前次 run 32562039785 conclusion=failure（D22 commit 所致 check-tasks 违规），修复叙事成立 |
| A · 冲突解决 | ✅ | 四文件零冲突标记；agent-runtime.md 尾部 SP-7 → SP-8 → D22 时间序；tracker.md / _index.md 的 T11（🔶）/T12（✅）行均含三件套链接列，六个物理文件存在 |
| B · dist-tags | ✅ | latest/next = 0.1.1-rc.2（npmmirror 与 registry.npmjs.org 一致） |
| B · rc 数量 | ✅（修正后） | 2026-08-10..21 实为 **10** 个 rc（0.0.1×3、0.1.0×5、0.1.1×2）；rc.1/rc.2 同日 08-21 相隔约 6 小时属实——见 F1 |
| B · sandbox 版本 | ✅ | `./host-sandbox/node_modules/@deepseek-ai/dsh/package.json` → 0.1.1-rc.1 |
| B · §5.4 一致性 | ✅（修正后） | 钉扎版本、dist-tags、首窗（08-22+14 天=09-05 所在周）一致；数字与命令可复现性修正见 F1/F3 |
| C · zone-checker | ✅ | check.ts checkModified 含 ownedRoots 豁免（带注释）；`bun run check:zones` → clean |
| D · D17 路径 | ✅ | T13 两文件 + 03 §5.4 新增行零 `D:\`/`D:/` 命中 |
| D · 占位/阻塞如实 | ✅ | 无占位；自检 §3 三项阻塞（X3/X6 待 key、S-pi 模型面后置）如实披露 |
| D · plan vs 自检 | ✅（修正后） | 版本钉扎复选框已翻 [x]，与自检 §2.2 一致——见 F2 |
| D · check:docs | ✅ | 38/38 通过（含两个新文件）；check:tasks 补跑亦通过 |
| E · 自由核验 | ✅ | tracker T13 行未登记属核验时点预期态（F4 已列闭环清单） |

## 2. 发现与处置（F1–F3 已修，F4 为流程提示）

- **F1（中·事实错误）**：「11 天 8 个 rc」实为 10 个——主 agent 首跑 `npm view time` 输出经 `tail -8` 截断导致漏数。处置：T13-plan §1.1、T13-self-check §2.2、03 §5.4 三处 8→10；自检注明纠正来源。定性结论（preview 颠簸是常态）不变且被加强。
- **F2（中·内部不一致）**：T13-plan §2「dsh 版本钉扎写入 §5.4」复选框未勾但自检 §2.2 声称完成。处置：闭环前翻 [x]。
- **F3（低·命令不可复现）**：版本核验命令 `require('spikes/s-x/host-sandbox/...')` 缺 `./` 前缀在任何 cwd 下 MODULE_NOT_FOUND。处置：03 §5.4 与自检 §2.2 均改为 `require('./host-sandbox/...')` 并注明 cwd = spikes/s-x。
- **F4（提示）**：闭环 commit 必须一次性包含 03 §5.4（M）+ T13 三件套 + tracker.md/_index.md T13 行，漏任一项会复现 D22 式 check-tasks 红。处置：本文件落盘即与其他各项同 commit 闭环。

## 3. 身份

本文件是 T13 的核验（verify），由独立 subagent 实做（只读 + 重跑），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律。
