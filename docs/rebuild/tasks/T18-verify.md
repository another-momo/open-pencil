<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T18-verify.md · T18 独立核验

> **T 编号**：T18（Phase 1-pi 启动 · pi SDK 主线：分支 + 版本钉扎 + S-pi 模型面补跑）
> **状态**：✅ 收口核验完成（2026-08-23，与实现者独立的 subagent 逐项实测；V1-V8 全过，结论见 §2）

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

### 1.1 V1 分支正确性 —— PASS（2026-08-23 实测）

- `git merge-base rebuild/v2 rebuild/pi` → `138553c50c65ae1a917703e745b7f5b5ef73e1d6`，与 `git rev-parse rebuild/v2` 相同——rebuild/pi 确从 rebuild/v2 HEAD `138553c5` 起
- `git rev-parse rebuild/pi` → `6d6e0c3a8508f169ede54d5874e7095daa785ecf`（HEAD 即 T18 P1-P4 提交）
- `git diff rebuild/v2..rebuild/pi --stat -- workbench/` → 空输出，workbench/ 零触碰；分支总 diff 仅 13 文件（docs/rebuild/* + spikes/s-pi/{README.md,live-chat.mjs,live-tool-result.mjs}），无越界改动
- `gh api repos/another-momo/open-pencil/git/refs/heads/rebuild/pi` → sha `6d6e0c3a...`；`.../refs/heads/rebuild/v2` → sha `138553c5...`——远端两分支 ref 各居其位；self-check §2.2 记录的推送事故（误推 v2 后已 force 重置）经复核无残留，v2 远端确实回到 `138553c5`

### 1.2 V2 钉扎纪律 —— PASS（2026-08-23 实测）

- 03 §5.5「pi 版本钉扎与升级窗口」（docs/rebuild/03-phase-1-runtime.md:202-215）四要素齐备：pin `@earendil-works/pi-coding-agent@0.84.2`（+pi-ai 0.84.2、typebox 1.3.7 同钉）；双周升级窗口（首窗 2026-09-05 所在周）；升级=独立 commit+重跑 S-pi 全证据脚本（offline + 本任务两个 live 脚本）；例外=非窗口期仅安全修复且 owner 拍板
- `cat spikes/s-pi/package.json` → 依赖三项精确锁定（`"0.84.2"`/`"0.84.2"`/`"1.3.7"`），无 `^`/`~` 前缀，与 §5.5 一致
- `npm view @earendil-works/pi-coding-agent version` → `0.84.2`（2026-08-23 本核验独立复跑）；`npm view @earendil-works/pi-ai version` → `0.84.2`；钉扎版即 npm 最新版声明属实
- `node -e "require('.../pi-coding-agent/package.json')"` → spike node_modules 实装 0.84.2
- narrative 03 有对应记录（`docs/rebuild/records/narrative/03-phase-1-runtime.md`「修正-N · 03 新增 §5.5 pi 版本钉扎与升级窗口（T18 P1）」）

### 1.3 V3 S-pi-1 活模型真实性 —— PASS（2026-08-23 独立重跑）

- key 提取：`grep OPENROUTER_API_KEY .../open-pencil-s-x/spikes/s-x/host-sandbox/dsh-home/.credentials.yaml | sed ...` 取值注入 env（长度 73，值未打印未落盘）；`cd spikes/s-pi && OPENROUTER_API_KEY=... node live-chat.mjs`
- **原样重跑**：退出码 0，8/8 PASS；首轮回合 6031ms，回复 1 字符「2」，delta 1 片，增量拼接==最终文本，usage 非零
- **防伪造/防缓存抽查**：临时把 prompt 由「1+1」改为「2+3」、断言字符由「2」改「5」重跑——退出码 0，8/8 PASS，回复「5」（5552ms）——回复跟随问题变化，非缓存非伪造；测后 `git checkout -- spikes/s-pi/live-chat.mjs` 还原，`git status --porcelain` 空、`git diff --stat` 空
- 脚本无硬编码 key：`grep -nE "sk-or-|apiKey\s*=\s*[\"'][^\"$]|OPENROUTER_API_KEY\s*=\s*[\"']" live-chat.mjs live-tool-result.mjs` 零命中；key 缺失显式 `process.exit(1)` 报错

### 1.4 V4 S-pi-2 活模型真实性 —— PASS（2026-08-23 独立重跑）

- **原样重跑** `node live-tool-result.mjs`：退出码 0，7/7 PASS；回合 10068ms；事件时间线完整（agent_start → turn_start → message_start → thinking_* → toolcall → tool_execution_start/end → 次回合）；消息结构 user→assistant→toolResult→assistant；toolResult 含 `SCENE-MARK-7f3a2c`；模型续跑回复原样复述标记串
- **MARKER 改值复跑（防伪造）**：临时把 `MARKER` 改为 `SCENE-MARK-v8k2p9-2026` 重跑——退出码 0，7/7 PASS，toolResult 与模型回复均复述**新值**（回合 7792ms，回复「SCENE-MARK-v8k2p9-2026 scene: frames=1 rects=2 bg=#FAFAFA detail=brief」）——工具本进程执行→结果回灌→模型消费全链为真；测后 `git checkout -- spikes/s-pi/live-tool-result.mjs` 还原，porcelain/diff 均空
- 工具进程内执行由 `toolExecutions === 1` 计数断言实证（execute 回调内自增）；本核验两次运行该断言均真实通过；未遇丢参数负例（免费档 + 显式参数指令模板两次均一次成功）

### 1.5 V5 01 F0 修正正确性 —— PASS（2026-08-23 逐条命令复核）

- **F0.2**：`ls src/app/automation/bridge/` → 恰 11 项（eval-handler/export-handlers/figma-factory/file-handlers/handlers/rpc-handler/selection-handler/server/target/tool-handlers/vite-plugin.ts）✔；`ls packages/mcp/` 在仓 ✔；`find src packages -name "*agent-vite-plugin*"` 零命中（已消失）✔
- **F0.3**：六条引证全灭逐条实证零命中——`find src packages scripts -name "*agent-transport.ts*"`、`*ImageGenKeysSection.vue*`、`*setImageGenCredentials*`、`find src -path "*marketing/settings*"`、`find src packages -path "*image-gen*"`、`grep -rn "v1/auth" src packages` 均空；`ls packages/` 无 agent 目录（仅 cli/core/dom-css/fig/harness/kiwi/mcp/pen/scene-graph/vue）✔；处置改「重建」与实况相符
- **F0.4**：`http-agent-transport.ts` find 零命中 ✔；`src/app/ai/chat/transports.ts` 在仓且 `grep` 见 `createToolLoopTransport`（:59）+ `ToolLoopAgent`（:2/:76）浏览器内路径 ✔；`grep -rn "harness:pi" src/app/ai/` 命中 `storage.ts:39`（行号与文档一致）✔；`ls src/components/chat/` 含 ChatInput.vue/ChatMessage.vue ✔；`src/components/ChatPanel.vue` 在 components 根目录 ✔
- **F0.7**：`ls scripts/` 仅 export-fixture-visuals/visual-bisect/visual-compare，inline-prompts.ts 零命中 ✔；`packages/agent` 不存在 ✔；`grep -n "system-prompt" src/app/ai/chat/transports.ts` → `:16 import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'`（?raw 运行时直读属实）✔；「已消除」定性有据
- narrative 01 有对应记录（`docs/rebuild/records/narrative/01-target-state.md`「修正-N · 01 §2 F0.2/F0.3/F0.4/F0.7 地面依据列 post-merge 实况修正（T18 P4）」）

### 1.6 V6 无占位（D19） —— PASS（2026-08-23 逐行审 + 实跑佐证）

- `live-chat.mjs`（127 行）8 个断言逐条审：getModel 命中、消息结构、非 error/aborted 终态、delta 序列非空、增量拼接==最终文本、回复非空、语义连贯、usage 非零——每个均对真实运行态取值判定，无恒真/凑数断言；`check()` 失败即计数并最终 `process.exit(1)`，无吞错
- `live-tool-result.mjs`（173 行）7 个断言逐条审：getModel、工具真实执行 1 次（进程内计数器）、tool_execution_start/end 成对且无错、消息结构四段式、toolResult 含标记串、模型续跑引用标记串——均为有效断言；V3/V4 的改参复跑（问题改 2+3、MARKER 改新值）实证断言确实随真实链路变化而 pass/fail，非摆设
- 分支新增文件仅三件套文档 + 两 live 脚本 + README 两行表格登记（`git diff rebuild/v2..rebuild/pi -- spikes/s-pi/README.md` 仅 +2 行）——无凑数文件

### 1.7 V7 key 卫生 —— PASS（2026-08-23 实测）

- 分支全部变更文件扫描：`git diff rebuild/v2..rebuild/pi --name-only | while read f; do grep -lE "sk-or-v1|sk-[a-zA-Z0-9]{20,}" "$f"; done` → 零命中
- 两 live 脚本只读 `process.env.OPENROUTER_API_KEY`，缺失显式报错退出；models.json 中 apiKey 为 `"$OPENROUTER_API_KEY"` 环境引用占位，非真值
- CI secret scan 为真实门禁：`ci.yml:88`「Scan for committed secrets」跑 `bun run check:secrets` → `tools/secret-scan/src/index.ts`（脚本实体在仓）；rebuild/pi 两个 run 该门禁随全绿通过（见 V8）

### 1.8 V8 远端 CI —— PASS（2026-08-23 实测）

- `gh run list -R another-momo/open-pencil --branch rebuild/pi` → 两个 run 均 `completed success`：
  - run `32627633002`（2m31s，2026-08-23T08:12:24Z）——`gh api .../runs/32627633002` 核 head_sha = `6d6e0c3a8508f169ede54d5874e7095daa785ecf`（T18 P1-P4 提交，分支 HEAD）
  - run `32627110480`（2m19s，2026-08-23T08:00:52Z）——head_sha = `bbef4f66974cfafc2d908afac886985689de7d90`（T18 注册提交）

## 2. 核验结论

**可以提交**（2026-08-23，独立 subagent 核验）。

V1-V8 全过，无问题项。关键实证：rebuild/pi 分支拓扑与远端 ref 全部正确（含推送事故复原无残留）；钉扎纪律成文且与锁版/npm 最新版三方一致；两个 live 脚本由本核验独立重跑各 2 次（原样 + 改参防伪造），断言全过且回复/标记串跟随输入变化，活模型链路为真；01 F0 四行修正的每条「在/无」引证均经本核验 ls/find/grep 复核属实；无占位断言、无 key 泄漏、CI 两 run 全绿。测试中对 spikes/s-pi 两脚本做的临时改参（prompt 2+3、MARKER 新值）均已 `git checkout` 还原，工作树干净。
