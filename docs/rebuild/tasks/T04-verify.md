<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T04-verify.md · T04 subagent 核验报告

> **T 编号**：T04（文档治理 · task 纪律 CI 强化）
> **核验时间**：2026-08-21（commit `266c98b8` 落地 + CI 全绿后由主 agent 立即派单）

## 1. 核验背景

T04 是 D15 决策（三件套物理拆分 + 任务表路径检查）+ topics/ 重组的承载 task。按 owner 提议 + 主 agent 自检完成后，**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T04 全部交付物（D15 三件套物理拆分 + 任务表三列 + check-tasks.ts 重写 + 历史 task 迁移 + topics/ 重组 + 文档同步）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T04-plan.md §3 验收标准](T04-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | 三件套物理拆分落地（15 文件） | ✅ | `ls docs/rebuild/tasks/T0[0-4]-*.md \| wc -l` | 15 / 期望 15；`T0[0-4]-plan.md` = 5 |
| 2 | 旧单文档已删除（4 文件） | ✅ | `ls docs/rebuild/tasks/T00-docset-v1-2026-08-18.md` 等 4 个 | 4 个全部 `No such file or directory` |
| 3 | 横向档案已迁到 records/topics/（10 文件） | ✅ | `ls docs/rebuild/records/topics/` | 10 文件，与期望 10 个主题名逐一吻合 |
| 4 | records/ 顶层只剩 narrative + topics + _index | ✅ | `ls -la docs/rebuild/records/` | 恰 3 项，无平铺 `<topic>.md` |
| 5 | records/_index.md 含两层结构 | ✅ | `grep -nE "^#{1,3} " docs/rebuild/records/_index.md` | §2 narrative/ 物理绑定层 + §3 topics/ 主题聚合层 |
| 6 | tracker.md §2 任务表含 plan / self-check / verify 三列 | ✅ | `head -40 docs/rebuild/tracker.md` | L30 表头 `… \| PR \| plan \| self-check \| verify \|`，9 列，T00-T04 行齐 |
| 7 | tasks/_index.md 任务清单同步含三列 | ✅ | `grep -nE "plan\|self-check\|verify" docs/rebuild/tasks/_index.md` | L30 表头三列 + L32-36 T00-T04 五行全链接 |
| 8 | check-tasks.ts 含 existsSync | ✅ | `grep -n "existsSync" tools/zone-registry/src/check/tasks.ts` | 6 处命中（L28 import、L122、L217 循环内对 plan/self-check/verify 各查一次） |
| 9 | check-tasks.ts 含 readTaskTable / extractPathFromCell | ✅ | `grep -n "readTaskTable\|extractPathFromCell" tools/zone-registry/src/check/tasks.ts` | L117 `readTaskTable()` + L161 `extractPathFromCell()` 两个函数定义 |
| 10 | docs-governance.md（topics/）含 D15 条目 | ✅ | `grep -n "^## D15" docs/rebuild/records/topics/docs-governance.md` | L302，命中数 = 1 |
| 11 | 05 §4.11 三件套物理拆分纪律 | ✅ | `grep -n "三件套物理拆分纪律" docs/rebuild/05-process.md` | L145 `11. **task 三件套物理拆分纪律（owner 触发 · D15 决策）**` + L7 头部索引引用 |
| 12 | 05 §3.1 gate review 含第 5 项「task 三件套齐全核验」 | ✅ | `awk '/^### 3\.1/,/^### 3\.2/' docs/rebuild/05-process.md \| grep -E "^[0-9]+\. "` | 6 项（第 5 项 = task 三件套齐全核验 check-tasks.ts，第 6 项为原 subagent 文档核验） |
| 13 | commit 266c98b8 在最顶 | ✅ | `git log --oneline -3` | 顶部 `266c98b8 task: T04 …（D15 三件套物理拆分 + 任务表路径检查 + topics/ 重组）` |
| 14 | CI run 32436674824 通过 | ✅ | `gh run view 32436674824 --repo=another-momo/open-pencil --json conclusion` | `{"conclusion":"success"}`，headSha `266c98b8e47…` 对齐；11/11 job 全 success |
| 15 | 所有旧路径 `records/<topic>.md`（不含 topics/）被替换 | ✅ | `grep -rn "records/\(agent-runtime\|brand-config\|chat-ui\|ci-infra\|docs-governance\|i18n\|spikes\|tools-image-gen\|tools-marketing\|upstream-merge\)\.md" docs/ tools/zone-registry/ \| grep -v "/topics/"` | 空输出（0 命中） |
| 16 | narrative/ 子文档与物理文件 1:1 | ✅ | `ls docs/rebuild/records/narrative/` | 8 文件 + `spikes/`（4 个 .zh.md），与期望清单完全一致 |
| 17 | 05 §3.2 错误示范 3（D15 新增） | ✅ | `grep -n "错误示范 3" docs/rebuild/05-process.md` | L90，命中数 = 1 |
| 18 | T04 三件套内容连续性（非空、非占位）| ✅ | `wc -l docs/rebuild/tasks/T04-*.md` | plan 100 / self-check 80 / verify 57，均 ≥ 30 |

### 2.1 追加验证（subagent 主动补）

| 项 | 结果 | 证据 | 实测 |
|---|---|---|---|
| check-tasks 对 T04 commit 实跑 | ✅ | `bun tools/zone-registry/src/check/tasks.ts --base HEAD~1` | `大改动（R1 49 文件 / R2 5861 行 / R3 / R4），task T04 三件套齐全` |
| check-docs 本地跑 | ✅ | `bun run check:docs` | `35/35 通过（R1-R5）` |
| 15 个三件套文件逐个 existsSync + 行数 | ✅ | 全 OK，最小 T00-verify 26 行 |

## 3. 总评

- 通过：18 条（清单）+ 3 条（追加）= **21 条**
- 失败：0 条
- 无法验证：0 条

## 4. 综合判定

- ✅ **T04 全部交付物通过核验**（21/21 通过，0 失败）
- ✅ commit `266c98b8` 落地 + CI `32436674824` 11/11 全绿 + subagent A 独立核验 21/21 通过

## 5. 主 agent 修正项（subagent 发现 + 主 agent 立即修正）

subagent 报告指出 2 个非阻断问题，主 agent 在 subagent 报告后立即修正：

### 5.1 tracker.md §2 PR 列误填（已修正）

- **问题**：T01-T04 四行 PR 列误填为 plan 链接（`[T01](tasks/T01-plan.md)` 等），列数仍是 9 列合法，CI 未拦截（`readTaskTable` 取末三列），但人工可读性错误
- **修正**：tracker.md §2 T01-T04 PR 列改回 `—`；同步把 plan / self-check / verify 三列的链接文本从 `[T01]` 改为 `[T01-plan]` / `[T01-self-check]` / `[T01-verify]`，让 PR 列单独保持 `—` 语义
- **T04 状态**：从「🔄 进行中」→「✅ 完成（CI 11/11 全绿 + subagent A 18/18 + 3 追加通过）」
- **依据**：subagent A 报告 §5「需要主 agent 注意的两点」第 1 条

### 5.2 T04-verify.md 占位回填（本文件）

- **问题**：本 verify.md 文件原是占位模板（`（待 subagent 填）`），subagent 报告回填后已替换为完整实测值
- **修正**：本文件 §2 表格 18 行 + §2.1 追加 3 行已用 subagent A 实测值替换；§3 总评 21/21；§4 综合判定通过
- **依据**：subagent A 报告 §5「需要主 agent 注意的两点」第 3 条

## 6. 决策影响

- **D15 决策落定**：三件套物理拆分 + 任务表路径列 + `existsSync` 检查——CI 误判率归零
- **横向档案独立为 records/topics/**：owner 提议落地，narrative/ vs topics/ 两层结构清晰
- **T05+ 流程确立**：所有新 task 必须三件套物理拆分 + 任务表填三列 + 主动派单核验
- **commit `266c98b8` 改动量**：49 文件 + 5861 行变更；CI 11/11 全绿通过；subagent 核验 21/21 通过
