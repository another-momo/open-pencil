<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T29-self-check.md · T29 自查记录

> **T 编号**：T29（决策批落地 · 文档面）
> **状态**：✅ 已收口（C1-C9 全过；远端 CI run 32831596110 + 32834978183 success（`gh run view` 复验 2026-08-25，B.3）；独立核验见 [T29-verify.md](T29-verify.md)）

## 1. 承诺 / 落地 / 偏差

| 承诺（plan §2） | 落地 | 偏差 |
|---|---|---|
| C1 补签组 | 落地（§2.1） | 无 |
| C2 CI-14 登记 | 落地（§2.2） | 无 |
| C3 规则文（05 三处） | 落地（§2.3） | 4 处命令名标记按设计留待 T28 回填，主 agent 已回填 |
| C4 D 编号 + D25-D29 | 落地（§2.4） | 无 |
| C5 tracker 归档 | 落地（§2.5），78 行 | 无 |
| C6 层 1 口径重建 | 落地（§2.6） | 无 |
| C7 根文档指针 | 落地（§2.7） | 无 |
| C8 决策批总登记 | 落地（§2.8） | #1/#2/#10 缺口按设计留待主 agent，已补登 |
| C9 纪律红线 | append-only 零违反；05 修改决策已登记；无本机路径入库 | 无 |

## 2. 分项实录（【事实】，2026-08-25 主 agent 收口时逐项 grep 复核）

### 2.1 T29-D1 补签组（C1）

- [01-target-state.md §6](../../01-target-state.md)：D3「已拍板（2026-08-25 owner 补签：一文件多会话 + 族谱形态确认；落地 = T22/T23）」；D5「已拍板（双模式保留；落地 = T24 chatMode 请求级）」（:85/:87 实测）
- [records/topics/agent-runtime.md](../../records/topics/agent-runtime.md)：D3 补签条目追加
- [records/topics/chat-ui.md](../../records/topics/chat-ui.md)：D5 补签条目追加
- [records/topics/docs-governance.md](../../records/topics/docs-governance.md)：D16 形式关闭条目 + 治理冻结期「部分解冻」拍板条目（堵漏型修正放行 / 新增治理面 Phase 2 继续冻结）

### 2.2 T29-D2 CI-14（C2）

- [records/topics/ci-infra.md CI-14](../../records/topics/ci-infra.md)（:216 实测）：rebuild/pi 分支保护开启——required checks 四项（Code quality / Package integrity / Repository hygiene / Rebuild discipline）+ enforce_admins + 保留 force-push 通道（API-push amend 需要）+ 禁删；已知边界登记（classic protection 不拦 direct push，实际闸门 = B.3 + pre-commit + check:tasks）

### 2.3 T29-D3/D4/D9 规则文（C3）

- [05-process.md §3.2](../../05-process.md) zones.json 变更报警（#6）：task 指针强制 + 不得用 `[no-task-plan]` 例外 + CI 摘要输出；命令名主 agent 收口回填 = `bun run check:tasks`
- [05-process.md §3.3](../../05-process.md) 补丁过堂（#5）：lastReviewed 字段 + upstream 合并时 `--base upstream/master` 全量过堂；命令名回填 = `bun run check:zones --patches-report`
- [05-process.md §3.3](../../05-process.md) 双周窗口（#15）：漂移 >20 commits 触发合并登记，与月合并/显著提前三口径取最先触发者
- [05-process.md §2](../../05-process.md) tracker 归档机制注（#8）
- [records/narrative/05-process.md](../../records/narrative/05-process.md)：修正-N 条目登记本批机制面落地；4 处标记回填事实同录

### 2.4 T29-D5 D 编号（C4）

- [records/_index.md §1](../../records/_index.md)（:20 实测）：Tk-Dn 规则文——全局 D 唯一递增仅跨任务；任务内自 2026-08-25 起一律 Tk-Dn；历史不回改、自然触及时顺手改
- [05-process.md §4 第 1 条](../../05-process.md) 同步改口
- [records/topics/agent-runtime.md](../../records/topics/agent-runtime.md)：D25-D29 补登（T20-T25 窗口 owner 拍板回填）+ 全局注册表停更现象闭环

### 2.5 T29-D6 tracker 归档（C5）

- [tasks/_index.md §6](../../_index.md)（:93-95 实测）：T00-T20 任务实录归档节建立，原文照录信息零丢失；T21 起近期行保留 tracker 原表
- [tracker.md](../../tracker.md)：任务表 T00-T20 行压缩为摘要 + 归档指针；全文 78 行（`grep -c ""` 实测 2026-08-25），≤80 预算重新可达；头部时间字段刷新

### 2.6 T29-D7 层 1 验收口径重建（C6）

- [01-target-state.md §3](../../01-target-state.md)：层 1 验收口径由「16 个移植测试文件全绿」（宿主随 T10 消失的空口径）重建为 **C1a-C5a 五环各配端到端冒烟全绿 + smoke:pi 批次全绿 + CI 绿**；§7 parity 线同步
- [tracker.md §1](../../tracker.md) Phase 3 行同步新口径

### 2.7 T29-D8 根文档指针（C7）

- 根 README.md：「OpenPencil Rebuild」节 4 行（:250-253），链 docs/rebuild/README.md + tracker.md，明示内部工作文档
- 根 AGENTS.md：Documentation 节 2 行（:113-114）docs/rebuild 指针
- CHANGELOG.md 不动（owner 拍板口径）
- zones 登记：主 agent 收口补 P58（README.md）/ P59（AGENTS.md），check:zones 转绿（`[zones] clean: 53 modified (all registered)`，2026-08-25）

### 2.8 T29-D10 决策批总登记（C8）

- [records/topics/docs-governance.md](../../records/topics/docs-governance.md)「决策批总登记」条目（:467 实测）：15 项逐项结论 + 落地指针；05 修改决策随条登记（05 自身纪律）
- #1/#2/#10 三项缺口：主 agent 收口 append-only 补登条目（「决策批总登记补登」），含 owner 原话 + T28 落地事实 + 报送源头指针

## 3. 门禁与纪律自检

- `bun run check:docs` / `check:bindings`：随 T28 面门禁一并复跑（收口 commit 前以 CI 为准）
- records/ append-only：本任务全部 records 变更为追加条目或头部时间字段刷新；4 处 `<待 T28 回填>` 为设计预留的不完整字段，回填不改历史陈述
- D17：全文无本机绝对路径（grep `D:\\` / `C:\\` 零命中，2026-08-25）
- 头部时间字段：01/05/tracker/_index/各 topics 档案均刷新 2026-08-25

## 4. 遗留与边界

- T26/T27/T28/T29 tracker 行「远端 CI 待回填」已于 2026-08-25 统一复验回填：runs 32809703730（ebaa0e1c）/ 32812269846（08b4129a）/ 32831596110（df908884）/ 32834978183（911d2c07）均 success（`gh run view` 复验，B.3 口径）
- tracker 行数：T28/T29 两行入库后 80 行贴预算顶；后续收口满一阶段即按 #8 机制归档 T21+ 行
- **机制幸免事件实录**（2026-08-25 主 agent 自查发现）：T28/T29 首版 commit message 正文在解释规则时含字面量 `[no-task-plan]`（ASCII 方括号）——check:tasks 豁免判定 `git log -1 --format=%B` 全文体正则匹配，不区分「 prose 提及」与「实际豁免 tag」，会把该 commit 的 task 校验整条跳过。已在入库前重写两个 commit message（正文改用无 ASCII 方括号表述），使校验真实运行。此为决策批 #9「占位正则/豁免维持现状」口径下的已知盲区：**commit message 正文禁写 ASCII `[no-task-plan]` 字面量**（规则文引用时用全角或无括号写法）——是否机器化（如仅匹配 trailer 行）留待 owner 决策，本任务不动检查器

