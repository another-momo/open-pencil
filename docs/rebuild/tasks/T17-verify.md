<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T17-verify.md · T17 独立核验

> **T 编号**：T17（ChatPanel 消费 SessionFace，M3 消息回路半）
> **状态**：🔄 任务进行中，尚未派单独立核验。C5 收口时由 subagent 按 §1 清单实测回填本文；当前内容为核验项预定，不构成任何「已通过」声明。

## 1. 收口核验项清单（C5 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 绑定层正确性：useCurrentSessionFace 跟随 ctx.sessions.list.current；切 session 重绑定、退订无泄漏；无 current 空态如实 | 源码审 + Playwright 切 session 实测 |
| V2 | 消息流渲染完整性：spike-alpha-1 历史（user/assistant/tool-call/think 块）在孤岛 ChatPanel 全型渲染；流式 partial 可见；running 指示正确 | Playwright 目检 + 截图 |
| V3 | 发送回路：孤岛内 prompt → openrouter/free 流式回复全文渲染；promptError 负例如实（如构造拒绝场景） | Playwright 实测 + 轨迹面板交叉对照 |
| V4 | 控制面：loadOlder 翻页可用（hasMore 时）；queue/pending 查明结论与 self-check 一致；降级声明（如有）如实 | 实测 + 文档对照 |
| V5 | 端到端冒烟：孤岛 ChatPanel 显式指令 → 模型调 openpencil_apply_design → 画布改图可见 | Playwright 截图 + bridge-call 复核图状态 |
| V6 | 无占位（D19）：workbench 新增/改动代码全部真实可用；无空组件凑 existsSync | 逐文件审 |
| V7 | 生命周期：孤岛 unmount/重挂后 ChatPanel 订阅链干净（E3 纪律延续） | 源码审 + 实测 |
| V8 | 远端 CI 绿 | gh api 查 run |

## 2. 核验结论

（C5 收口时由 subagent 填报实测值与结论；本文此前不含任何核验结论。）
