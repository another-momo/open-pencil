<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# runbook-github-push.md · GitHub 推送通道手册

> **状态**：生效中 | **时间**：2026-08-24 | **身份**：运维 runbook（推送故障时的标准处置流程）
> **对应 records**：[records/narrative/runbook-github-push.md](records/narrative/runbook-github-push.md)

## 1. 背景与教训

本机到 GitHub 的连通性会分面失效：git 数据面（github.com:443）被黑洞时，REST 面（api.github.com:443）可能完全健康。2026-08-23 与 2026-08-24 两次实证（T24/T25 收口推送）：git push 挂起 20s+ 超时或 connection reset，同期 `gh run list`（走 api.github.com）一切正常。

**核心教训：同一命令盲重试是最贵的策略**——每次尝试烧 20 秒超时且不产生新信息。正确姿势：先花 30 秒探测分面，按探测结果一次选对通道。

## 2. 通道盘点（按优先级）

### 2.1 git push over HTTPS（默认，首选）

正常情况走这里。**最多试 1-2 次**，出现 `Connection was reset` / `port 443 ... Could not connect` 即判定数据面故障，立刻转探测分流，不要进入重试循环。

### 2.2 gh api Git Data REST —— `.gh-api-push.mjs`（本仓已备工具，主 fallback）

仓根脚本 `.gh-api-push.mjs`：逐 commit 走 `POST git/blobs` → `POST git/trees` → `POST git/commits` → `PATCH git/refs`，内容寻址保证远端 SHA 与本地逐字节一致（脚本内逐层校验，不一致即抛错）；ref 更新后 push 事件正常触发 CI。

- **前提**：api.github.com 可达 + `gh` 已认证（判定信号：`gh run list --repo another-momo/open-pencil --limit 1` 能出结果）
- **用法**：`PUSH_BRANCH=rebuild/pi node .gh-api-push.mjs <commit> [<commit>...]`（commit 按时间顺序；默认分支是 rebuild/v2，**必须显式设 PUSH_BRANCH**）
- **实证**：2026-08-24 T25 收口补记 d9823dad 经此路推送成功（当时 HTTPS 数据面全挂），CI run 32740318724 正常触发并全绿
- **限制**：逐 blob 上传，大 commit 慢；LFS 实体不走此路（git 里的 LFS 指针 blob 可以推，本仓 5 件 fixture 本就不动）；单文件 100MB 上限
- **强退**：`PUSH_FORCE=1` 环境变量（仅确知远端无人并行推时使用）

### 2.3 SSH 22（git@github.com）

另一传输层，网络掐断面对其可能不同。**未验证**本机是否配置 deploy key（探测：`ssh -T git@github.com -o ConnectTimeout=5`，2026-08-24 未实测）。

### 2.4 SSH over 443（ssh.github.com:443）

GitHub 官方为「443 通、22 被掐」场景设计：remote 换 `ssh://git@ssh.github.com:443/another-momo/open-pencil.git`（探测：`ssh -T -p 443 git@ssh.github.com -o ConnectTimeout=5`）。**未验证**（2026-08-24 未实测，需先有 SSH key）。

### 2.5 代理

`git config http.proxy` 或系统代理。本机当前未配置（2026-08-24 `git config --get http.proxy` 空）；有可用代理时优先级提到 2.2 之前。

## 3. 标准处置流程

```
Step 0  探测（30 秒内出结果，三选二即可定位）：
          curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://github.com
          gh run list --repo another-momo/open-pencil --limit 1   # 通 = api.github.com 健康
决策：
  github.com 通            → git push（1-2 次，勿循环）
  github.com 挂 + gh 通    → PUSH_BRANCH=rebuild/pi node .gh-api-push.mjs <commit>
  两路全挂                 → 探测 SSH（2.3/2.4）与代理（2.5）；
                             都无可行 → 挂起等待 + 向 owner 上报，不挡主线工作
推送后验证：gh run list 确认 CI 触发（API 推送同样触发 push 事件）
```

**重试纪律**：同通道最多 3 次短间隔重试；失败即换通道；无新通道可用即停手等待——不做同命令长循环。

## 4. 禁止项

- 不为推送把 key/凭证写进任何脚本或日志（gh 认证走自身 keyring）
- 不用 `--force` 覆盖远端除非确知无并行推送（本仓规则与「docs/rebuild 不用 PR 管理」一致，force 仅限 rebase 后且经 owner 知情）
- 不把「推送失败」静默降级为「不推送」——本地领先远端的 commit 必须在收口汇报中显式声明
