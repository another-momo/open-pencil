<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T18-verify.md · T18 独立核验

> **T 编号**：T18（Phase 1-pi 启动 · pi SDK 主线：分支 + 版本钉扎 + S-pi 模型面补跑）
> **状态**：⬜ 待收口（本文 §1 为核验项预定清单，**不构成任何已通过结论**；收口时由与实现者独立的 subagent 逐项实测后就地重写填报）

## 1. 收口核验项清单（收口派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 分支正确性：rebuild/pi 从 rebuild/v2 HEAD 起、已推远端；workbench/ 未被触碰 | `git log`/`git diff` 实证 |
| V2 | 钉扎纪律：03 新增小节内容完整（pin 版本 + 升级窗口 + 升级流程），与 spikes/s-pi/package.json 锁版一致；narrative 有对应记录 | 文档审 + 命令复核 |
| V3 | S-pi-1 活模型真实性：独立重跑 `live-chat.mjs`（自带 key 环境），断言全过、回复非伪造（内容随机性抽查）；脚本无硬编码 key | 重跑 + 源码审 |
| V4 | S-pi-2 活模型真实性：独立重跑 `live-tool-result.mjs`，tool_execution 事件成对、工具进程内执行日志、模型回复含标记串；模型丢参数等负例如实记录 | 重跑 + 源码审 |
| V5 | 01 F0 修正正确性：F0.2/F0.4/F0.7 新地面依据逐条复核（引证文件存在性用 ls/find 自查）；narrative 同步 | 文档审 + 命令复核 |
| V6 | 无占位（D19）：新增 live 脚本每个断言真实有效；无凑数文件 | 逐文件审 |
| V7 | key 卫生：仓内任何新增文件不含 key；gitleaks 可复跑 | grep + CI secret scan |
| V8 | 远端 CI：rebuild/pi HEAD run 全绿 | gh run list |

## 2. 核验结论

（收口时填报：「可以提交」或问题清单）
