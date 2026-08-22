<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T14-verify.md · T14 核验（subagent 实做）

> **T 编号**：T14（Phase 1-X 实施 · 插件骨架产品化，MS-X1）
> **核验人**：独立 subagent（只读 + 可执行重跑），2026-08-22
> **被核验文档**：[T14-self-check.md](T14-self-check.md)
> **结论**：**可以提交**（12 项全绿；F1/F2 证据引用精度问题已就地修正，不阻塞）

## 1. 核验结论表

| 项 | 结论 | 依据 |
|---|---|---|
| A · 文件集非占位 | ✅ | workbench/ 13 个将入库文件全在（含 package-lock.json + 2 张真实 PNG）；src/index.js 176 行 host 实现、src/client/index.jsx 147 行 island 实现，无占位 |
| A · zones 登记 | ✅ | ownedRoots 含 workbench/、patches 含 P35；`bun run check:zones` clean |
| A · D17 + ignore | ✅ | 将入库文本零 `D:\`/`AgentLearn` 命中；lib/ 与 node_modules/ 被 workbench/.gitignore 正确排除（git check-ignore 实证） |
| A · 依赖钉扎 | ✅ | 全精确版无 ^/~；与 spike lockfile 实证值逐一相等（tsdown 0.22.14 / react 18.3.1 / react-dom 18.3.1 / vue 3.5.18 / ws 8.18.3）；react 仅 devDependencies、无 peerDependencies |
| B · 构建重跑 | ✅ | `npm ci` added 60 packages + 双产物 Build complete；lib/client.js banner/jsx-runtime/无生 JSX 三检通过；探针残留 0；`node --check lib/index.js` 通过；无 tsdown 进程持锁 |
| C · 沙箱装机 | ✅ | profile link 指向 rebuild worktree 的 workbench/；bundles 数组含 openpencil-marketing；node_modules 软链可用 |
| C · 宿主与 preset | ✅ | 3080 → 200；RPC session.create agentPreset 回显 ok:true |
| D · 文档一致 | ✅ | 自检 §2.4 与 README 开发回路节表述一致；plan 复选框 W1-W4+W6 已勾 |
| D · CI job 合法 | ✅ | YAML 可解析；X1 守护三命令在 `bash -eo pipefail` 下对真实产物模拟 PASS |
| D · 治理检查 | ✅ | check:docs 38/38；check:bindings 全绿；check:tasks 通过 |
| E · spike 残留 | ✅ | workbench 源内 spike 字样仅 README 证据引用一处；host src 与 spike 逐行等价（差异=改名+注释产品化） |
| E · **服务端到端** | ✅ | :3080 首页 boot entries 含 openpencil-marketing client.js；**宿主 serve 的 client.js 与 workbench/lib/client.js 逐字节相同**（1,335,782 bytes cmp 无差异）——link + 产物服务链路实证 |

## 2. 发现与处置

- **F1（低，已修）**：自检 §2.3 引用的宿主重启日志行不在 host-sandbox/dsh-web.log（该文件停留在 spike 时代）。处置：自检已注明出处为启动终端/后台任务 stdout 捕获，并补全字段截断说明；声明实质由核验方独立证实（boot entries + .agent-presets 行为）。
- **F2（轻微，已修）**：自检 §2.1「147 added」与核验时点「148 added」差 1（三件套自身落盘的先后序效应）。处置：自检改为核验时点口径并注明变动机制。
- **F3（观察，非问题）**：client/index.jsx 相对 spike 的差异超出改名——Vue 岛从计数器探针换为工作台壳 + 桥状态探针。系 W3 声明的产品化实现载体，与截图证据一致。

## 3. 身份

本文件是 T14 的核验（verify），由独立 subagent 实做（只读 + 重跑），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律。
