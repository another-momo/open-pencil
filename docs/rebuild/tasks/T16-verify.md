<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T16-verify.md · T16 独立核验

> **T 编号**：T16（7600 桥真链路 + token 链）
> **状态**：🔄 任务进行中，尚未派单独立核验。B4 收口时由 subagent 按 §1 清单实测回填本文；当前内容为核验项预定，不构成任何「已通过」声明。

## 1. 收口核验项清单（B4 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 真桥起服：127.0.0.1:7600 上是真桥（register/auth/relay 三角色），非 spike 桩 | 协议实测（错 token 负例 + register 正例）+ 进程核实 |
| V2 | token 链：discovery 文件 → host 插件 → island 同源取 token 链路真实；token 不进日志/源码 | 逐跳复现 + grep |
| V3 | island 桥客户端：经真桥 register，getDocumentTree 返回 island 活编辑器真实节点 | 浏览器 + 桥协议复现 |
| V4 | host 工具端到端：`openpencil_apply_design` 经桥改 island 画布，返回真实结果；island 未注册时错误语义如实 | dsh RPC 驱动 + 截图目检 |
| V5 | 断线重连 + dispose 接入 E3 链（onUnmounted 清理） | 源码审 + 实测 |
| V6 | 无占位（D19）：workbench 新增/改动代码全部真实可用 | 逐文件审 |
| V7 | spike 桩退役声明如实：dev 回路不再依赖桩（桩脚本保留作证据不删） | 进程 + 配置核实 |
| V8 | 远端 CI 绿 | gh api 查 run |

## 2. 核验结论

（B4 收口时由 subagent 填报实测值与结论；本文此前不含任何核验结论。）
