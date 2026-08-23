<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T19-verify.md · T19 独立核验

> **T 编号**：T19（Phase 1-pi 实施 · 后端换心：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动）
> **状态**：⬜ 待收口（本文 §1 为核验项预定清单，**不构成任何已通过结论**；收口时由与实现者独立的 subagent 逐项实测后就地重写填报）

## 1. 收口核验项清单（收口派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 后端 service 真实性：pi session 装配与 T18 形态一致；端点收 prompt 回 UIMessage v1 SSE（curl 实测 SSE 帧序列） | 源码审 + curl |
| V2 | 事件映射正确性：text/reasoning/finish/error 四组按 S-pi-4 表；增量拼接==最终文本；中文场景无乱码 | curl 实测 + 对照表 |
| V3 | 前端零改动：Chat 类/ChatPanel.vue 等组件 git diff 为零；改动仅限选路 + 新 transport + 后端 | git diff 实证 |
| V4 | live 冒烟复现：dev server + 真实 openrouter/free，浏览器发消息流式可见 | Playwright 复跑 |
| V5 | session 连续性：同 tab 二轮上下文正确；后端 JSONL 落盘存在 | 实测 + 文件核验 |
| V6 | 无占位（D19）：新增代码全部真实可用；无凑数文件 | 逐文件审 |
| V7 | key 卫生：key 仅后端 env；仓内零 key | grep + CI secret scan |
| V8 | 远端 CI：rebuild/pi HEAD run 全绿；既有测试不破 | gh run list |

## 2. 核验结论

（收口时填报：「可以提交」或问题清单）
