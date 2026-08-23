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
| P1 | 分支 rebuild/pi + pi 钉扎纪律成文 | 🔄（分支已建；纪律待成文） |
| P2 | S-pi-1 活模型补跑（live-chat.mjs） | ⬜ |
| P3 | S-pi-2 主线活模型补跑（live-tool-result.mjs） | ⬜ |
| P4 | 01 F0.2/F0.4/F0.7 地面依据 post-merge 修正 | ⬜ |

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

（P1-P4 执行后回填）
