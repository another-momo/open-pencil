<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T18-self-check.md · T18 自检记录

> **T 编号**：T18（Phase 1-pi 启动 · pi SDK 主线：分支 + 版本钉扎 + S-pi 模型面补跑）
> **状态**：🔄 开工（注册期 recon 完成，P1-P4 执行中持续回填）

## 1. 任务清单对照

| 执行面 | 内容 | 状态 |
|---|---|---|
| P1 | 分支 rebuild/pi + pi 钉扎纪律成文 | ✅ |
| P2 | S-pi-1 活模型补跑（live-chat.mjs） | ✅ 8/8 PASS |
| P3 | S-pi-2 主线活模型补跑（live-tool-result.mjs） | ✅ 7/7 PASS |
| P4 | 01 F0.2/F0.3/F0.4/F0.7 地面依据 post-merge 修正 | ✅（执行中扩 scope 一行，见 §2.5） |

## 2. 实测记录

### 2.1 2026-08-23 注册期 recon（全部附核验命令）

1. **分支起点**：`git checkout -b rebuild/pi rebuild/v2` → HEAD `138553c5`（2026-08-23 实证）；`git merge-base --is-ancestor spike/s-pi rebuild/v2` 为真——S-pi spike 全部产出（离线测试 + 证据）已在主线 `spikes/s-pi/`，无需从 spike 分支起
2. **spike 现状**：`spikes/s-pi/` 自包含（不在 root workspaces），依赖精确锁 pi 0.84.2 全家桶（`cat spikes/s-pi/package.json`）；`npm run test:offline` = offline-echo.mjs + offline-session-persistence.mjs 两脚本
3. **pi 版本钉扎依据**：`npm view @earendil-works/pi-coding-agent version` → `0.84.2`（2026-08-23），与 T11 证据基线一致，npm 最新版即证据版
4. **openrouter 通路**：pi-ai 内置 openrouter provider（baseUrl `https://openrouter.ai/api/v1`，`参考项目/pi/packages/ai/src/providers/openrouter.ts:11`，2026-08-23 读源码）；env key 约定 `OPENROUTER_API_KEY`（`pi-ai/src/env-api-keys.ts:94`）；`openrouter/free` 不在内置模型目录（`providers/data` 目录无独立 json 落盘可读，catalog 由 generate-models 脚本生成），走 models.json 覆盖内置 provider 路径（`参考项目/pi/packages/coding-agent/docs/models.md` §Overriding Built-in Providers，2026-08-23 读文档）
5. **key 复用点**：owner 已配的 openrouter key 存于 `open-pencil-s-x/spikes/s-x/host-sandbox/dsh-home/settings.yaml`（openrouter provider 段，2026-08-23 grep 实证存在，值不引用不打印）；执行时读取注入 `OPENROUTER_API_KEY` 环境变量
6. **01 F0 地面依据 post-merge 核查**（2026-08-23 `ls`/`find` 实证）：`packages/agent` **已消失**（T10 上游合并移除）；`src/app/http-agent-transport.ts`、`agent-vite-plugin.ts` **已消失**（`find src` 零命中）；现存 AI 路径为 `src/app/ai/chat/transports.ts` 双路径——浏览器内 AI SDK ToolLoopAgent（`createToolLoopTransport`，DirectChatTransport）+ harness sidecar（providerID `harness:pi`，`storage.ts:39` 实证）；`packages/harness`（含 `backends/pi.ts`）在仓但属 D21 搁置路线，不占 runtime 路径；`src/app/automation/bridge/`（7600 桥族）在仓
7. **dsh 线休眠态**：workbench/ 原样保留在 rebuild/pi 分支（D24 归档口径），本任务不触碰

## 3. 完成度自评

（核验后由收口结论刷新）

### 2.2 2026-08-23 P1 分支 + 钉扎纪律

1. **分支**：`rebuild/pi` 从 rebuild/v2 HEAD `138553c5` 创建（git checkout -b 实证）；远端 ref `refs/heads/rebuild/pi` 建立于注册提交 `bbef4f66`
2. **推送事故与修正（如实记录）**：初推时 `.gh-api-push.mjs` 硬编码 ref `heads/rebuild/v2`，注册提交被误推上 rebuild/v2；已用 gh api PATCH 将 v2 ref 重置回 `138553c5`（force）、POST 新建 rebuild/pi ref；脚本已参数化（`PUSH_BRANCH` 环境变量，默认 rebuild/v2 不变）——事故零内容损失，两分支现各居其位
3. **钉扎纪律成文**：03 新增 §5.5「pi 版本钉扎与升级窗口」（pin pi-coding-agent/pi-ai 0.84.2 + typebox 1.3.7；双周升级窗口首窗 2026-09-05 所在周；升级=独立 commit+重跑 S-pi 全证据脚本含本任务 live 脚本；安全修复例外需 owner 拍板）；narrative 03 同步

### 2.3 2026-08-23 P2 S-pi-1 活模型面（live-chat.mjs，8/8 PASS）

- **脚本**：`spikes/s-pi/live-chat.mjs`——models.json 覆盖内置 openrouter provider 注入 `openrouter/free`（apiKey 走 `$OPENROUTER_API_KEY` 环境引用，不落盘）；断言：getModel 命中 / 消息结构 user→assistant / 非 error 终态 / text_delta 序列非空 / 增量拼接==最终文本 / 回复非空 / 语义连贯（含「2」）/ usage 非零
- **实测**（key 从 dsh-home/.credentials.yaml refs 注入 env，不打印）：`node live-chat.mjs` 退出码 0，8/8 PASS；首轮回合 10217ms，回复 4 字符（"2"），delta 1 片——**pi SDK 库形态 + openrouter/free 活链路一次跑通**
- **key 定位记录**：dsh settings.yaml 里是 `apiKeyEnv: OPENROUTER_API_KEY` 间接引用；真实 key 存 `dsh-home/.credentials.yaml` 的 refs 段（2026-08-23 实测）；shell/user/machine 环境变量均未设置（printenv + powershell GetEnvironmentVariable 实测）

### 2.4 2026-08-23 P3 S-pi-2 主线活模型面（live-tool-result.mjs，7/7 PASS）

- **脚本**：`spikes/s-pi/live-tool-result.mjs`——`defineTool` 注册 `scene_summary` 文本工具（返回含唯一标记串 `SCENE-MARK-7f3a2c` 的场景摘要，模拟 look 通道 B 结构）；显式参数指令（免费档纪律：参数逐字照抄 `{"detail":"brief"}`）；断言：工具真实执行 1 次 / tool_execution_start+end 成对无错 / 消息结构 user→assistant→toolResult→assistant / toolResult 含标记串 / 模型续跑回复引用标记串
- **实测**：退出码 0，7/7 PASS；回合 17303ms；事件时间线完整（agent_start → turn_start → message_start → toolcall_start/delta/end → tool_execution_start/end → 次回合 thinking_* → text → turn_end）；模型回复原样复述标记串——**真实模型调工具 → 我们进程执行 → 结果回灌 → 消费续跑，全链实证**
- 免费档一次成功（显式指令模板生效），无丢参数负例

### 2.5 2026-08-23 P4 01 F0 地面依据 post-merge 修正（执行中扩 scope，如实记录）

- **计划扩 scope**：注册时定三行（F0.2/F0.4/F0.7）；执行中普查发现 F0.3 引证也已全灭（agent-transport.ts、marketing/settings.ts、image-gen/providers.ts、ImageGenKeysSection.vue、setImageGenCredentials、/v1/auth 均 find/grep 零命中）——按「计划被实测推翻就地改」纪律，plan §1.2-4/§2-A5/§3-P4 就地扩为四行
- **四行修正落地**（01 §2，均附核验命令+日期）：F0.2 桥 11 项在仓但 dev 拉起面需重查；F0.3 处置「移植并统一」→「重建」（无码可移）；F0.4 现存双路径实况（ToolLoopAgent 浏览器内 + harness:pi sidecar，D21 搁置不占路径）；F0.7 处置→「已消除」（脆依赖随 T10 移除，现存 system-prompt.md `?raw` 运行时直读，transports.ts import 实证）
- narrative 01 已同步
