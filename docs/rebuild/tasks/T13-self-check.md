<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T13-self-check.md · T13 自检

> **T 编号**：T13（Phase 1-X 收口 · D22 拍板后）
> **分支**：`rebuild/v2`
> **状态**：合并回归 + 版本纪律完成；S-X 模型面补跑按「阻塞即上报」列入 §3

## 1. 结论速览

| # | 事项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 双 spike 合并回归 rebuild/v2 | ✅ CI 全绿 | §2.1 |
| 2 | dsh 版本钉扎 + 双周升级窗口成文 | ✅ 03 §5.4 | §2.2 |
| 3 | zone-checker ownedRoots 豁免修复 | ✅ 随合并入库 | §2.3 |
| 4 | S-X 模型面补跑 | ⏸ 阻塞待 key | §3 |

## 2. 分项证据

### 2.1 合并回归（先执行后登记，时序已在 plan §1.2 披露）

- merge commits：`694f4a29`（merge(T12): spike/s-x 回归）、`918b048c`（merge(T11): spike/s-pi 回归）
- 冲突解决全部为尾部追加型按时间序并集：`records/topics/agent-runtime.md`（SP-7 08-21 → SP-8 → D22 08-22）、`records/narrative/tracker.md`（T11 修正 → T12 修正 ×2）、`tracker.md`/`tasks/_index.md`（T11 行取 s-pi 侧 🔶、T12 行取 s-x 侧 ✅，两侧三件套均齐）
- 核验命令：`git log --oneline -3 origin/rebuild/v2`（918b048c 在顶，2026-08-22）；`gh run view 32563228158 -R another-momo/open-pencil --json conclusion` → success（2026-08-22），Rebuild discipline job success——D22 commit 所致 check-tasks 违规（run 32562039785）由此根修
- 网络障碍实录：push 时 github.com 解析 IP（20.205.243.166）被黑洞（`nslookup github.com` + `curl --resolve` 实测 2026-08-22，备选 IP 20.27.177.113 返回 200/0.4s）；以 loopback CONNECT 代理钉 IP 完成推送（`.gh-connect-proxy.mjs`，仅监听 127.0.0.1:7899，TLS 端到端不受影响）

### 2.2 版本纪律成文

- 落点：[03-phase-1-runtime.md §5.4](../03-phase-1-runtime.md)（钉扎 0.1.1-rc.1 / 双周窗口首窗 2026-09-05 所在周 / 升级独立 commit 重跑 S-X 证据脚本 / 安全修复例外）
- 版本事实（2026-08-22 核验）：
  - 基准版本：`node -e "console.log(require('./host-sandbox/node_modules/@deepseek-ai/dsh/package.json').version)"` → `0.1.1-rc.1`（cwd = spikes/s-x；host-sandbox 被 gitignore，需在 spike 环境执行）
  - `npm view @deepseek-ai/dsh dist-tags --json` → latest/next 均 `0.1.1-rc.2`
  - `npm view @deepseek-ai/dsh time --json` → 2026-08-10..21 共 10 个 rc，rc.1（08-21T06:49）与 rc.2（08-21T12:42）同日（首跑误记为 8 个，核验 subagent 以完整 time 列表纠正为 10）

### 2.3 zone-checker 修复（随 694f4a29 入库）

- 问题：`tools/zone-registry/src/check.ts` 的 checkModified 以 MERGE_HEAD 为 base 时，把 ownedRoots（docs/、spikes/ 等）下自有文件的合并冲突解决误判为「MODIFIED but not registered」（该规则本为上游合并场景设计——相对 upstream MERGE_HEAD 的修改才需要补丁登记）
- 修复：checkModified 增加 ownedRoots 豁免（checkAdded 早已豁免 ownedRoots，本次对齐）；上游文件不可能位于 ownedRoots 下，无规则漏洞
- 验证：694f4a29 合并 commit 经 pre-commit 全绿（check:zones/docs/bindings/tasks），CI run 32563228158 Rebuild discipline success

## 3. 阻塞清单（阻塞即上报，未伪造通过）

| 阻塞项 | 解除条件 | 说明 |
|---|---|---|
| X3 模型自主调 `openpencil_apply_design` 端到端 | **owner 补 DeepSeek API key** | dsh 的 DeepSeek 模型 text-only（SP-8），离线面已尽；key 到位后约 2-3h 可跑完（含 X6） |
| X6 模型回复体现 type 变化 | 同上 | 装配面已 8/8 绿（SP-8），模型行为面无法离线覆盖 |
| S-pi 模型面（DeepSeek 通道 B 消费续跑 / 视觉通道 A 探测） | 随 pi 产品版后置（D22） | 不在本主线补跑 |

## 4. 身份

本文件是 T13 的自检（self-check），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律；核验见 [T13-verify.md](T13-verify.md)。
