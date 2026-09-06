<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T12-verify.md · T12 核验（subagent 实做）

> **T 编号**：T12（S-X spike 执行 · dsh-X 路线实证）
> **核验人**：独立 subagent（只读 + 可执行重跑），2026-08-22
> **被核验文档**：[T12-self-check.md](T12-self-check.md)
> **结论**：**可以提交**（六项离线面证据真实可复现，X5 硬 gate 经核验方重跑独立确认；F1–F4 低危，已全部修掉）

## 1. 核验结论表

| 项 | 结论 | 依据 |
|---|---|---|
| A · tsconfig 声明 | ✅ | 仓库根 tsconfig.json:18 为 `"jsx": "preserve"`；plugin/tsconfig.json:3 为 react-jsx；tsdown 0.22.14 的 dist/config.mjs grep 无 jsx 键；plugin/lib 被 .gitignore 排除、plugin/package-lock.json 在入库列（git check-ignore 实证） |
| A · D17 绝对路径 | ✅ | 将入库文件（docs 三件套、evidence/*.json、*.mjs、plugin/src、presets、yml）0 命中 `D:\`/`D:/`；绝对路径仅存于被 gitignore 的 host-sandbox/ |
| A · 数字核对 | ✅ | X2 1792/1792/0/0 与 RTT p50=1/p95=1/max=6 同证据一致；X6 promptLengths [48,264,264,48]；X3 数值见 F3 处置 |
| B · x3 重跑 | ✅ | 7/7 PASS，exit 0 |
| B · x6 重跑 | ✅ | 8/8 PASS，exit 0 |
| B · x5 重跑 | ✅ | host 在跑（3080 → 200），13/13 PASS，exit 0 |
| C · 占位/作弊 | ✅ | 全部脚本为真实实现；x5 断言真实读 window.__spikeIsland 计数器 + DOM 引用同一性 + title 交替；ws-bridge-server.mjs apply_design 为真实不可变拷贝 patch + 引用 diff |
| C · 工具调用路径 | ✅ | applyDesignExecute 导出（plugin/src/index.js），注册为一元委托（F1 措辞已修） |
| D · plan vs self-check | ✅ | §2 八项全 [x]，与自检一致 |
| D · SP-8 数字 | ✅ | 与 evidence 吻合（F3 量级化表述后） |
| D · §7.1 vs 自检结论 | ✅ | X3 判据实测达标；X6 模型面诚实拆分阻塞、未伪造 |

## 2. 发现与处置（F1–F4 全部已修）

- **F1（措辞）**：自检原称驱动器与工具注册「同一函数引用」，实为 `execute: (args) => applyDesignExecute(args)` 一元委托。处置：插件注释与自检 §2.4 均改为「同一函数体的直接委托」，并记录原因（dsh 以 (args, execCtx) 二元调 execute，dsh-tools lib 实证 `.execute(exec.arguments, exec)`，直接赋值会把 execCtx 误当 bridgeUrl 参数）。
- **F2（证据固化）**：首启 `installed:true` 日志随宿主重启被覆盖、不可直接复核。处置：删沙箱 preset 目录重启宿主复现首启安装，日志脱敏（D17，绝对路径→`<DSH_HOME>`）存 `spikes/s-x/evidence/x4-preset-install.log`；自检 §2.5 已指向该文件。
- **F3（数字漂移）**：幂等重跑覆盖证据文件，X3 精确值微漂（p50 0.024→0.025、D max 8.2→8.447），结论不变。处置：自检 §2.4 改为现证据值 + 注明首跑值与漂移机制；SP-8 改为量级表述（≈0.025ms / ≈8.4ms）。
- **F4（超前勾选）**：T12-plan §2 的 X7 在核验文档落盘前已勾。处置：本文件落盘即闭环。

## 3. 重跑原始结果摘要

| 驱动器 | 结果 | exit |
|---|---|---|
| `node x3-apply-design.mjs` | 7/7 PASS（A diffMs min=0.021 p50=0.025 p95=0.167 max=0.167、bridgeMs max=16；B changedNodes 精确；C 双错误路径拒绝；D 1000 节点 min=0.390 max=8.447） | 0 |
| `node x6-system-prompt-probe.mjs` | 8/8 PASS（48→264→264→48，逐次求值证实） | 0 |
| `node x5-gate-test.mjs` | 13/13 PASS（5 次切换 reactMounts=1/vueMounts=1/vueUid=0/sameNode=true 全程不变，title 交替证实真切换，切换后计数器可交互，console 0 error） | 0 |

补充活验：RPC `session.list` 实测确认 `session-87c95853-…` 存在且 `agentPreset:"openpencil-design"`；HTTP RPC 信封格式声明（自检 §4）实测属实。

## 4. 核验边界声明

- 核验方为 subagent 独立实做（非主 agent 自证）；X5 硬 gate 结论经核验方独立重跑确认。
- 模型面（X3 模型调工具、X6 模型回复响应）不在本次核验范围——无 API key，按「阻塞即上报」列自检 §3。
