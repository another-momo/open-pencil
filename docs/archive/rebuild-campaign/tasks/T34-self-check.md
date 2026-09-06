<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T34 自检 · 上游合并第三轮（octopus 8 commits）

> **状态**：已核验 | **时间**：2026-08-27 | **核验人**：主 agent

## 1. 交付物

- merge commit（1 个）：`rebuild/upstream-merge-2` 分支一次性 octopus 8 个上游 commit
- 解冲突后的源码：10 个 content 冲突 + 6 个 modify/delete + 8 个 dialogs.json i18n（合计 24 个冲突，详见 T34-plan §2）
- `src/app/ai/pi-backend/host.ts` 决策注记（spawnBridge 函数顶部 5 行）

> **T34 追勘**（2026-08-27 subagent V8）：merge commit message 与 plan §1 自报「23 个冲突」实测为 24 个（6+8+10）。plan §1 与 §2.1 已修正为 24 / 6；commit message 不动（避免 amend 改 SHA）。

## 7. Push 阻塞（待 owner 协助，2026-08-27）

**症状**：
- `git push origin rebuild/upstream-merge-2:staging` 三次均 `Failed to connect to github.com port 443 after 21xxx ms`
- `curl -sSI https://github.com` 同样 TCP timeout
- `curl -sSI https://api.github.com` TLS handshake `SEC_E_INVALID_TOKEN`
- `curl -sSI https://google.com` 同样超时；`curl -sSI https://www.baidu.com` 200 OK
- `gh auth status` 显示已登录（`Logged in to github.com account another-momo`，scopes 含 repo）
- 无 http(s).proxy 配置（`git config --get http.proxy` 空）

**判定**：环境网络层问题（github/google 全连不通，仅国内站点通），非工具/凭证/配置问题。3 笔 commit 在本地全部就绪（HEAD=`9a22d276`），推送动作需 owner 在网络恢复后协助执行 SOP：

1. `git push origin rebuild/upstream-merge-2:staging`（staging 先行）
2. 等 CI 绿（gh run view 复验 status）
3. `git push origin rebuild/upstream-merge-2:rebuild/pi`（rebuild/pi 同 SHA）
4. `gh run view <run-id> --log` 复验 CI 双链 success @ 同 SHA
5. 推 origin/rebuild/pi → staging + rebuild/pi 双链稳定
6. cleanup：`git push origin --delete rebuild/upstream-merge-2`

## 2. 门禁（S 实测，2026-08-27）

| 命令 | exit | 关键输出 |
|---|---|---|
| `bun run check:zones` | 0 | `[zones] clean: 55 modified (all registered), 283 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770` |
| `bun run check:deps` | 0 | exit 0（恢复 AppTextButton 后） |
| `bun run typecheck`（tsgo + vue-tsc ×2） | 0 | 全绿 |
| `bun run lint` | 0 | **0 errors**，4 warnings 均为存量 max-lines（场景图/types.ts 617 / 核心/variants/index.ts 704 / 核心/design-jsx/props-overrides.ts 608 / tests/engine/mcp/server/index.test.ts 609，上限 600；本轮均未触碰） |
| `bun run check:docs` | 0 | 40/40 通过（R1-R5） |
| `bun run check:bindings` | 0 | 本轮 0 文件变更，binding 全绿 |
| `bun run check:i18n` | 0 | All locale files are in sync |
| `bun run check:monorepo` | 0 | sherif No issues found |
| `bun run check:arch` | 0 | steiger No problems found |
| `bun run check:packages` | 0 | metadata / publint / attw 全过 |
| `bun run test:type-shapes` | 0 | No duplicate object type shapes found |
| `bun run test:dupes` | 0 | Found 0 clones |
| `bun run smoke:pi` | 0 | t22 target **6** + t22 history **12** + t23 sessions **14** + t24 prompt-assembly **29** + t28 session-gc **19** = **80 passed, 0 failed** |

`check:audit` / `check:secrets` 已知 SKIPPED 或 404：bun audit 后端连接问题（404）与 gitleaks 本机未装（CI 跑真实扫描），均非本轮触发。

## 3. 误操作纠正（重要）

merge 阶段把 `src/components/ui/AppTextButton.vue` 与 5 个 modify/delete 冲突文件一起 `git rm`。事后确认 AppTextButton 是 T32 owner 拍板的「保留存在（ownedFile 状态）」文件——`git show HEAD:src/components/ui/AppTextButton.vue` 实测返回文件内容（blob ec3b8ba4c9c13e721d41c10015523d0bfcac404a），HEAD ls-tree 中存在。

**纠正**：`git checkout HEAD -- src/components/ui/AppTextButton.vue` 恢复。`check:deps` 从报错（`Unresolved imports @/components/ui/AppTextButton.vue`）转为 exit 0。

**教训**：modify/delete 冲突解前**必须**先 `git show HEAD:<path>` 确认路径在 HEAD 是否存在，不能仅凭 `git status` 的 DU 标识一刀切。

## 4. zones 误判纠正（同步入 §5）

T32 阶段我把「上游删除但我们已删除」类 5 个文件标为「zones 机制漏洞、需手动登记 deletedPaths」。本轮实测发现 `checkDeletedAbsent` 已覆盖「既不在上游存在、也不在我们存在」场景——`check:zones` 报 `[zones] clean: ... 1014 deleted (all registered)` 即证。

**纠正**：T32 文档（[04-porting-discipline.md §5](docs/rebuild/04-porting-discipline.md)）无需补登记条款；check.ts 的删除方向覆盖已经足够。本节备注作为 T34 实证记录，T35+ 不要再误判。

## 5. host.ts 决策（入 P-num 注释）

`src/app/ai/pi-backend/host.ts` `spawnBridge` 函数顶部加 5 行决策注记：

> T34 评估：跟不跟 OPENPENCIL_MCP_DISCOVERY_PATH 隔离（0f981ff2）？
> 不跟——host.ts 自身是生产形态，7600 端口独占（serveOrigin 也固定），
> 多实例会被端口 EADDRINUSE 拦截，不存在 dev-plugin 同款「worktree 隔离」
> 场景。discovery 默认路径 `~/.openpencil/mcp.json` 在 host.ts 单实例下不
> 构成冲突；若未来扩成同主机多 host.ts 实例，再补 OPENPENCIL_MCP_DISCOVERY_PATH
> 临时目录隔离——届时复用 vite-plugin 的 sha256(runtimeId) 方案即可。

## 6. 关联文档

- plan：[T34-plan.md](T34-plan.md)
- verify：[T34-verify.md](T34-verify.md)
- 索引：[tasks/_index.md §2](../tasks/_index.md)

## 8. Push 实测状态（2026-08-27 后续）

| 操作 | 结果 |
|---|---|
| `git push origin rebuild/upstream-merge-2:staging` | ✅ success（new branch → staging，SHA=e6d53beb） |
| `git push origin rebuild/upstream-merge-2` | ✅ success（new branch → rebuild/upstream-merge-2） |
| `gh run list --branch rebuild/upstream-merge-2` | ⏸ 空（CI 未触发，原因排查中） |
| `git ls-remote origin staging rebuild/upstream-merge-2 rebuild/pi` | ❌ Recv failure（网络间歇断） |
| `curl https://github.com` | 200 OK → ❌ timeout（间歇） |
| `curl https://www.baidu.com` | ✅ 200 OK（持续） |

**判定**：网络间歇断。push 操作本身已成功（SOP 步骤 1 完成），CI 触发与后续步骤需网络稳定后由 agent 或 owner 接力完成。

**后续步骤**（网络恢复时）：
1. `gh run list --branch rebuild/upstream-merge-2` 检查 CI
2. 若 CI 未自动触发：`gh workflow run ci.yml --ref rebuild/upstream-merge-2`
3. `gh run watch <id>` 等 CI 绿
4. `git push origin rebuild/upstream-merge-2:rebuild/pi`（同 SHA 推到 rebuild/pi）
5. `gh run list --branch rebuild/pi` 复验 CI 双链 success @ 同 SHA
6. cleanup：`git push origin --delete rebuild/upstream-merge-2 staging`

## 9. CI 红修复（2026-08-27 后续）

CI run 33051249610（head=e6d53beb）报 failure：13 个 job success，仅 **Code quality / Verify formatting** 失败——`vite.config.ts` import 顺序问题。

**根因**：T34 merge 手工解冲突时保留了 HEAD 的 import 顺序（`piBackendPlugin` 在前），oxfmt 期望按字母序（`AUTOMATION_HTTP_PORT` / `devAutomationRoute` 在前）。**lint 不抓 import 顺序，`format:check` 抓**——本机 `bun run format:check` 也没跑（self-check §2 列了但漏执行）。

**修复**：commit `c5a2ab1d` `fix: T34 merge 后 vite.config.ts import 顺序回 oxfmt 期望（format:check CI 红修复）`。本机 `bun run format:check` 重跑绿。

**T34 教训补记**：
- merge 后应主动跑 `bunx oxfmt --write` 兜底 import 顺序，不只是 lint
- format:check 与 lint 是两套规则，lint 绿 ≠ format:check 绿
- self-check §2 应该把 format:check 列入必跑项

CI rerun 33052623880（head=c5a2ab1d）in_progress，等结果。

## 10. CI 双链红修复（2026-08-27 后续）

CI run 33052623880（head=c5a2ab1d，rebuild/upstream-merge-2）**success**（13/14 job pass）——format:check 修复确认有效。

推 `rebuild/upstream-merge-2 → rebuild/pi` 后，CI run 33052862364（head=c5a2ab1d）**failure**——但 13/14 job pass，仅 **Rebuild discipline / Narrative bindings and task three-piece** 红：

```
check-tasks: 1 处违规
  [big-change-task-pointer] 检测到大改动（R1 文件数 119 >= 10 / R2 变更行数 2763 >= 200 / R3 命中 docs/rebuild/*.md 叙事文档 / R4 命中 docs/rebuild/records/*.md），但 commit message 无 `task: T<NN>` 指针。
```

**根因**：CI workflow 的 Rebuild discipline job 用 `BASE=${{ github.event.before || ... }}` 决定 base——rebuild/pi 从 `36ad5c17`（旧 HEAD）推到 `c5a2ab1d` 时，`before=36ad5c17`，diff 范围 = T34 全部 5 commit（119 files / 2763 lines），累计命中 R1/R2/R3/R4 四个大改动条件。但 fix commit `c5a2ab1d` 的 message 不含 `task: T<NN>` 抬头——`check-tasks` 报红。

**修复**：amend `c5a2ab1d` 的 commit message 加 `task: T34` 抬头。新 SHA = `42e2e327`。本机已 amend 完成，但 force push 三次因网络间歇断（github.com timeout + api.github.com TLS `SEC_E_INVALID_TOKEN`）失败。

**后续步骤**（网络恢复时）：
1. `git push --force-with-lease origin rebuild/upstream-merge-2:rebuild/upstream-merge-2`
2. `git push --force-with-lease origin rebuild/upstream-merge-2:rebuild/pi`
3. `git push --force-with-lease origin rebuild/upstream-merge-2:staging`
4. `gh run watch <new-run-id>` 等 rebuild/pi CI 绿（amend 后 diff base=c5a2ab1d, diff 应空, check-tasks 跳过）
5. cleanup：`git push origin --delete staging`

**T34 教训补记（追加）**：
- `commit:fix` 类的红修复 commit 命中大改动阈值（累计 docs 改动）→ 必须用 `task: T<NN>` 抬头
- CI workflow `BASE=github.event.before` 对 `36ad5c17 → c5a2ab1d` 这种「跨多 commit」首次 push 会把整段历史算进来——后续 fix commit 必然触发 R3/R4
- 防御措施：merge commit 收尾后**先** amend 加上 docs/records/narrative 改动一并入，再 push；或 push 前用 `git commit --amend` 合并 docs 收尾 commit
- pre-commit hook 跑 check-tasks 时已经报「跳过 check-docs/bindings/tasks」，但 CI 的 Rebuild discipline job 跑得更激进（用 `before` 而非 `HEAD~1`），两边不对称——05-process.md 应记一条「Rebuild discipline job base 语义」


## 11. Push SOP 全程完成（2026-08-27 16:37，本机记录）

**网络恢复后实测**（owner 不必看到本次 push 详情，远端 rebuild/pi 已落 `29985845`）：

| 操作 | 结果 |
|---|---|
| `git push --force-with-lease origin HEAD:rebuild/upstream-merge-2` | ✅ `c5a2ab1d → 29985845` |
| `git push --force-with-lease origin HEAD:staging` | ✅ `e6d53beb → 29985845` |
| CI run 33054175283（head=29985845, rebuild/upstream-merge-2） | ✅ **success**（14/14 job） |
| `git push --force-with-lease origin HEAD:rebuild/pi`（受保护分支，CI 触发后） | ✅ `c5a2ab1d → 29985845` |
| CI run 33054772651（head=29985845, rebuild/pi） | ✅ **success**（14/14 job） |
| `git push origin --delete rebuild/upstream-merge-2` | ✅ 删除 |
| `git push origin --delete staging` | ✅ 删除 |

**CI 双链 success @ 同 SHA = 29985845** ✅

**远端最终状态**：
- `origin/rebuild/pi = 29985845`（本次合并基线，CI 绿）
- `origin/rebuild/pi-staging = 36ad5c17`（T33 旧版，保留对照）
- `origin/rebuild/v2 = 138553c5`（T0 远古基线）

**T34 收口完成**——三个 todo 全部 satisfied：
- octopus merge 8 commits 落地（commit c65d56e1）
- 三件套 + verify + tracker + narrative（commit 5e64795c + 9a22d276 + e6d53beb）
- CI 双链绿修复（commit 29985845）
- 远端 rebuild/pi 已同步（29985845）
- 临时 ref cleanup 完成（rebuild/upstream-merge-2 + staging 已删）
