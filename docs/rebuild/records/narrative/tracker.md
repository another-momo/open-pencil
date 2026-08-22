<!--
  写作纪律（改本文前必读）：
  - 本文是 tracker.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/tracker.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[tracker.md](../../tracker.md)（一一对应）
> **身份**：本档案持有针对 tracker.md 的修正记录。tracker 是活文档，本身不直接腐烂。

---

## 修正类

## 修正-1 · tracker.md 精简为索引 + records/ 子文档

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-20 18:30
- **内容**：原 106 行（阶段门 + 决策日志 + 任务表 + WIP 审判 + 核验日志 + 腐烂记录 6 类）精简为 50 行内索引（阶段门 + 任务表 + 记录索引 3 块）；详细记录按对象归 records/ 子文档
- **影响**：[tracker.md](../../tracker.md) 3 块结构；records/ 11 个对象子文档建立

## 修正-2 · tracker.md 进一步重组（records/narrative/）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-20 19:30（本改进项）
- **内容**：records/* 按对象分类重组为 records/narrative/<file>.md 一一对应 + records/ 下保留横向档案（docs-governance / ci-infra / upstream-merge）
- **影响**：[tracker.md §3 记录索引](../../tracker.md) 表格需更新（同步本改进项）

---

## 核验类

## 整改后核验

- **类型**：核验
- **时间**：2026-08-20 18:30 / 19:30
- **核验人**：主 agent
- **结论**：tracker.md 两次精简均落地

---
## 修正-N · tracker.md 任务表填充（T00 / T01 / T02）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-20 21:30
- **依据**：本轮整改 D13 决策
- **内容**：原 tracker.md §2 任务表为空（"Phase 1 开工后逐行登记"），现填充 T00（历史回填）/ T01（已 commit 的整改）/ T02（本次改进）三行
- **影响**：[tracker.md §2 任务表](../../tracker.md) 与 [tasks/_index.md §2 任务清单](../_index.md) 保持一致——两个表互为指针

## 修正-N · tracker.md T02 状态更新 + T03 新增（T03 整改）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：本轮整改 D14 决策（owner 触发）
- **内容**：
  - T02 行状态从「🔄 进行中」→「✅ 完成（CI 11/11 全绿，核验-N 后置）」
  - 新增 T03 行：[05-process.md §4.10](05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地），状态「🔄 进行中」，任务计划指针 [tasks/T03-process-binding-clause-2026-08-21.md](../tasks/T03-process-binding-clause-2026-08-21.md)（2026-08-21 D15 整改后已拆为三件套：[tasks/T03-plan.md](../tasks/T03-plan.md) / [tasks/T03-self-check.md](../tasks/T03-self-check.md) / [tasks/T03-verify.md](../tasks/T03-verify.md)）
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00/T01/T02/T03 四行，与 [tasks/_index.md §2 任务清单](../_index.md) 一致

## 修正-N · tracker.md §2 任务表加 plan / self-check / verify 三列 + T04 新增（T04 整改）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：本轮整改 D15 决策（owner 提议"任务表填三列路径 + CI 查表对路径"）
- **内容**：
  - [tracker.md §2 任务表](../../tracker.md) 表头从 7 列扩为 9 列，新增 `plan` / `self-check` / `verify` 三列（D15 决策核心）
  - T00 / T01 / T02 / T03 行的"任务计划"列更新为 plan 列，新增 self-check / verify 列；T00 历史回填（owner 验收）+ T01 待 owner 验收 + T02 CI 11/11 全绿 + T03 CI 11/11 全绿 + subagent A 18/18 通过
  - 新增 T04 行：[05-process.md §4.11](../05-process.md) task 三件套物理拆分纪律补漏（D15 决策落地），状态「🔄 进行中」，任务计划指针 [tasks/T04-plan.md](../../tasks/T04-plan.md)
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00/T01/T02/T03/T04 五行，9 列（含 plan / self-check / verify 三列路径），与 [tasks/_index.md §2 任务清单](../_index.md) 9 列镜像同步——CI 用 `existsSync` 检查三件套物理文件存在

## 修正-N · tracker.md §2 任务表 PR 列修正 + T04 状态更新（T04 收尾）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：本轮整改 D15 + subagent A 核验报告（发现 PR 列误填 plan 链接）
- **内容**：
  - T01 / T02 / T03 / T04 行 PR 列改回 `—`（原误填为 `[T0N](tasks/T0N-plan.md)` 形式，列数仍 9 列合法，但语义错误——PR 列应保留 `—` 至真实 PR 号落地）
  - plan / self-check / verify 三列链接文本从 `[T01]` 改为 `[T01-plan]` / `[T01-self-check]` / `[T01-verify]`，提升可读性
  - T04 行状态从「🔄 进行中」→「✅ 完成（CI 11/11 全绿 + subagent A 18/18 + 3 追加通过）」
- **影响**：[tracker.md §2 任务表](../../tracker.md) PR 列恢复空状态，T04 状态与 subagent 核验结论同步

## 修正-N · tracker.md §3 记录索引重写（owner 提示"信息过期"，2026-08-21）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：owner 提示"§3 记录索引信息已过期"
- **背景**：原 §3 表格只列 10 个横向档案 + `_index.md` 指针，**完全没提 narrative/ 物理绑定层**——与 §4.10 D14 / §4.11 D15 引入的两层结构不匹配
- **内容**：
  - §3 重写为三层：3 标题"记录索引" + 顶层提示两层结构 + §3.1 narrative/ 物理绑定层（仅指向 `_index.md §2`，不重复列表）+ §3.2 topics/ 主题聚合层（横向档案表保留，因高频人工查阅）
  - 删除原 11 行"全部子文档索引"重复项（指向 `_index.md` 即可）
  - 加上对 `records/_index.md` 的指针作为权威列表
- **影响**：[tracker.md §3](../../tracker.md) 现反映 D14/D15 两层结构，与 [05-process.md §4.10 + §4.11](05-process.md) 同步

## 修正-N · tracker.md §2 任务表加 T05 行（T05 收尾）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T05 owner 提问（00-05 系统性 review）+ D15 三件套物理拆分纪律
- **内容**：在 [tracker.md §2 任务表](../../tracker.md) T04 行后新增 T05 行（plan / self-check / verify 三列路径 + 状态"🔄 进行中"）
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00-T05 共 6 行 + 三列路径，CI `existsSync` 检查三件套物理文件存在

## 修正-N · tracker.md §2 任务表 T05 行状态更新（T05 收尾 + subagent A 19/19 通过后）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：subagent A 19/19 通过核验
- **内容**：在 [tracker.md §2 任务表](../../tracker.md) T05 行状态从「🔄 进行中」→「✅ 完成（CI 11/11 全绿 × 2 commits + subagent A 19/19 通过）」；PR 列从「—」保持「—」；标题列补充「+ D17 本机绝对路径清理」
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00-T05 共 6 行 + 全部状态对齐 subagent 核验结果

## 修正-N · tracker.md §2 任务表加 T06 行（T06 收尾）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：D15 三件套物理拆分纪律 + T06 task 落地
- **内容**：在 [tracker.md §2 任务表](../../tracker.md) T05 行后新增 T06 行（CI 基础设施 · LFS cache 启用 · 状态"🔄 进行中"）
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00-T06 共 7 行 + 三列路径，CI `existsSync` 检查三件套物理文件存在

## 修正-N · tracker.md §2 任务表 T06 行状态更新（T06 收尾完成）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T06 commit `0ac548e6` 落地 + T07 收尾
- **内容**：在 [tracker.md §2 任务表](../../tracker.md) T06 行状态从「🔄 进行中」→「✅ 完成（setup-bun action.yml 加 actions/cache@v6）」
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00-T06 共 7 行，全部状态对齐

## 修正-N · tracker.md §2 任务表删 PR 列（T08 整改 · owner 反馈）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T08 owner 反馈（"tracker.md 的任务表总是写错位，plan 填到了 PR 列，目前我们没有采用 PR 来管理，请删掉 PR 列及相关描述"）
- **内容**：
  - [tracker.md §2 任务表](../../tracker.md) 列数从 9 列 → 8 列（删除 PR 列）
  - [tracker.md §2 标题](../../tracker.md) 简化："能力块 = 1 PR + 验收测试 + 本表一行 + 三件套路径列 D15" → "每个 task 一行 + 三件套路径列 D15"
  - [tracker.md §2 T07 行状态](../../tracker.md) 修正：✅ 完成 → 🔄 进行中（T07 commit `0ac548e6` 实际未 push + CI 未跑；T08 收尾后同步）
- **根因**：本仓库 `docs/rebuild/` 范围**不采用 PR 管理**——任务以 commit + 任务表登记为唯一载体，PR 列毫无意义（subagent A 在 T04 收尾时只改了 PR 列链接文本，没意识到 PR 列本身就不该存在）
- **影响**：
  - tracker.md 任务表 8 列结构（T 编号 / 块 / 内容 / 验收 / 状态 / plan / self-check / verify）与 `readTaskTable()` 函数读末三列对齐
  - §1 阶段门表"验收签字"列保留（语义与 PR 不同——是 owner 验收签字）

## 修正-N · tracker.md §2 任务表 T07/T08 行状态更新（T08 收尾 + subagent A 12/12 通过后）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：subagent A 12/12 通过核验
- **内容**：
  - [tracker.md §2 任务表](../../tracker.md) 新增 T08 行（文档治理 · tracker.md 任务表删 PR 列 · 状态"✅ 完成（CI 11/11 全绿 + subagent A 12/12 通过）"）
  - T07 行状态从「🔄 进行中（T08 收尾后同步）」→「✅ 完成（CI 11/11 全绿 + subagent A 通过）」
- **影响**：[tracker.md §2 任务表](../../tracker.md) 现含 T00-T08 共 9 行 + 全部状态对齐 subagent 核验结果

## 修正-N · tracker.md T09 整改（任务表结构 + 行数预算 + 计数）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-18）；T06/T07 核验回填完成
- **内容**：
  1. §2 T07/T08 行补「状态」cell（7d013794 写入时缺列，7 cell vs 8 列表头——「写错位」复发）；T07 状态随核验回填由 🔄 → ✅（subagent A 12 通过 + 1 警告）
  2. §2 新增 T09 行
  3. 头部「≤50 行」放宽为「≤80 行」（任务表随 task 增长，原预算不可达）
  4. §3.1 计数修正：「14 份 narrative 档案」→ 实测 13（6 叙事 + README + tracker + 4 spike + 1 proposal）
  5. 注记：上一修正条目（T08 整改）内「T07 commit `0ac548e6`」系张冠李戴，正确为 `5698019a`（ROT-17）
- **影响**：任务表真源与镜像（tasks/_index.md §2）恢复一致

## 修正-N · tracker.md T09 行状态收尾（T09 完成）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T09 全部验收达成——远端 CI run 32447539784 12/12 success（含新 Rebuild discipline job 首跑），subagent A 核验 N1-N5 闭环
- **内容**：任务表 T09 行状态 🔄 → ✅ 完成（附 CI 与核验证据指针）；tasks/_index.md 镜像行同步

## 修正-N · tracker.md 任务表加 T10/T11/T12 行（T10 开工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：D20 owner 拍板（upstream 合并先行 + 双 spike 并行登记）
- **内容**：任务表新增 T10（upstream 合并 + Phase 1 启动，🔄）/ T11（S-pi spike，⬜ 待 T10）/ T12（S-X spike，⬜ 待 T11 后按需触发）三行；tasks/_index.md 镜像同步

## 修正-N · tracker.md T10 行闭环 ✅（T10 收工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T10 全部验收达成——远端 CI run 32458703514 12/12 success（HEAD 1749b877），rebuild/v2 fast-forward 004b1f48 → 1749b877；三轮 CI 修复明细见 [T10-verify.md §6](../../tasks/T10-verify.md)
- **内容**：任务表 T10 行状态 🔄 → ✅ 完成（附 CI 与 ff 证据）；T11 行「⬜ 未开工（待 T10）」→「⬜ 可开工（T10 已闭环）」；tasks/_index.md 镜像行同步

## 修正-N · tracker.md T11 行状态推进（离线面全过，活模型面阻塞）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-21
- **依据**：T11 S-pi spike 离线面全过——offline-echo.mjs 8/8 + offline-session-persistence.mjs 16/16（commit e58a6ea9，spike/s-pi 分支），subagent 独立核验通过（F1-F4 已就地修正，见 [T11-verify.md](../../tasks/T11-verify.md)）；活模型面因环境无 API key 阻塞（如实披露，T11-self-check.md §3）
- **内容**：任务表 T11 行状态 ⬜ → 🔶「离线面全过（subagent 核验讫），活模型面阻塞待 owner 补 key」；self-check/verify 列由 — 补链；tasks/_index.md 镜像行同步
## 修正-N · tracker.md T12 行状态推进（T12 离线面收工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：S-X spike 六项验证离线面全绿——X1 双框架 island（console 0 错）、X2 1h 浸泡 0 断连、X3 diff 全量 <50ms（7/7）、X4 preset 首启安装+agent 面加载、X5 硬 gate 通过（5 次切换零重建）、X6 装配面 8/8；subagent 独立核验结论「可以提交」（F1-F4 低危已修）；模型面两项按「阻塞即上报」列自检 §3
- **内容**：任务表 T12 行状态 ⬜ → 🔄「离线面六项全绿 + subagent 核验『可以提交』（待 push 后 CI）」，自检/核验链接回填；tasks/_index.md 镜像行同步

## 修正-N · tracker.md T12 行闭环 ✅（T12 收工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T12 全部验收达成——远端 CI run 32560998564 12/12 success（HEAD dab1ba8c，spike/s-x）；S-X 六项离线面全绿（X5 硬 gate 通过：5 次真实 session 切换 island 零重建，evidence/x5-gate-result.json）；subagent 独立核验「可以提交」（F1-F4 已修）；X3/X6 模型面按「阻塞即上报」列自检 §3
- **内容**：任务表 T12 行状态 🔄 → ✅ 完成（附 CI 与 gate 证据指针）；tasks/_index.md 镜像行同步
## 修正-N · tracker.md T13 行登记即闭环 🔶（T13 收工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T13 收口达成——双 spike 合并回归（merge commits 694f4a29 / 918b048c，CI run 32563228158 全绿含 Rebuild discipline，根修 D22 commit 所致 run 32562039785 红）；dsh 版本钉扎 + 双周升级窗口成文（[03-phase-1-runtime.md §5.4](../../03-phase-1-runtime.md)）；zone-checker ownedRoots 豁免随 694f4a29 入库；subagent 独立核验「可以提交」（F1 rc 数字 8→10、F2 复选框、F3 命令路径，均已就地修正）；S-X 模型面补跑按「阻塞即上报」列自检 §3（待 owner 补 DeepSeek key）
- **内容**：任务表新增 T13 行，状态 🔶「合并回归+版本纪律完成；模型面补跑阻塞待 owner 补 key」，三件套列齐；tasks/_index.md 镜像行同步
- **task 文档**：[tasks/T13-plan.md](../../tasks/T13-plan.md)

## 修正-N · tracker.md T14 行登记（owner 批准路线图后开工）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：owner 拍板下一阶段路线图（会话原话「开始」「推进」），T13 收口完成后进 T14 插件骨架产品化（MS-X1）
- **内容**：任务表新增 T14 行，状态 🔄 开工，plan 列链接 [T14-plan.md](../../tasks/T14-plan.md)，self-check/verify 列待闭环回填；tasks/_index.md 镜像行同步

## 修正-N · tracker.md T14 行闭环 ✅（T14 收工，MS-X1 达成）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T14 验收全达——workbench/ 骨架落地（npm ci + build 绿、X1 回归三检过）；沙盒装机冒烟（island 起、7600 桥在线 2ms、console 0 错、RPC preset 接受、宿主 serve 产物与工作区逐字节一致——subagent 实证）；**HMR 决策点 4 证伪为 A 级**（dsh web 对 client module 产物做模块级热替换，mounts 1→2→3 两轮复现、window 存活非整页刷新）；CI 加 workbench-build job（P35）；subagent 独立核验 12/12「可以提交」（F1/F2 证据精度已就地修正）
- **内容**：任务表 T14 行状态 🔄 → ✅ 完成，self-check/verify 列回填；tasks/_index.md 镜像行同步
- **task 文档**：[tasks/T14-plan.md](../../tasks/T14-plan.md)

## 修正-N · tracker.md T14 行 CI 证据回填

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T14 闭环 commit 7643ca39 的 CI run 32568952869 因 format:check（zones.json 经 node 重写后 stubs 数组未按 oxfmt 内联）红——修复 commit 7722d445（oxfmt 归一化）后 run 32569154626 全绿（含新 workbench-build job 首跑绿）
- **内容**：T14 行状态补 CI run 32569154626 证据；tasks/_index.md 镜像行与 T14-self-check §2.5 同步回填

## 修正-N · tracker.md T15 行登记（owner 推进 M2 编辑器入孤岛）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：owner 拍板「推进」，T14 收口完成后进 T15（M2 编辑器入孤岛，全路线最大风险项，估 5-6 人日）；E1 风险探针先行（CanvasKit wasm 能否在 island 初始化），其前置未知「wasm 资产服务」已在注册期以源码实证定案——webServer prefix 路由方案（serveBundle 白名单 / webServer.register API / frontend-static inject 先例三处源码实证，详见 [T15-self-check §2.1](../../tasks/T15-self-check.md)）
- **内容**：任务表新增 T15 行，状态 🔄 开工，三件套列一次登记齐（self-check/verify 为如实进行中态，非占位：self-check §2 已含注册期 recon 实测，verify §1 为收口核验项预定、明确声明不含已通过结论）；tasks/_index.md 镜像行同步
- **task 文档**：[tasks/T15-plan.md](../../tasks/T15-plan.md)

## 修正-N · tracker.md T15 行 E1/E2 通过回填

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T15 E1（CanvasKit wasm 孤岛初始化探针，最大风险 R1）一次执行通过——wasm 经插件自注册 webServer prefix 路由伺服（200 / 7,159,342B / application-wasm），readPixels 像素校验 true，initMs 485，console 0/0（commit 1749aebe，CI run 32571734912 绿）；E2（编辑器外壳入孤岛）达成并超额——真实引擎链（@open-pencil/core + @open-pencil/vue）在孤岛内渲染 demo scene，点选（topmost 命中）/拖拽移动（含 Figma 语义自动 reparent）/悬停/HMR 热替换（6.03MB 编辑器包、reactMounts 1→2、无整页刷新、暖启 125ms）全部实测通过，console 0/0；构建期五项发现（yoga TLA shim、node builtin 双层 stub、css-tree ESM 重定向、tsdown alias 顶层键、vue 四份拷贝收敛）详见 [T15-self-check §2.1](../../tasks/T15-self-check.md)
- **内容**：任务表 T15 行状态 🔄 开工 → 🔄 进行中（E1/E2 通过：wasm 路由 + 编辑器渲染/选中/拖拽实证）；tasks/_index.md 镜像行同步
- **task 文档**：[tasks/T15-plan.md](../../tasks/T15-plan.md)

## 修正-N · tracker.md T15 行闭环 ✅（M2 编辑器入孤岛达成）

- **类型**：修正（按对象：tracker.md）
- **时间**：2026-08-22
- **依据**：T15 验收全达——E1 CanvasKit wasm 孤岛探针通过（commit 1749aebe，路由 200/7,159,342B、像素回读 true）；E2 真实编辑器（core+vue 引擎链）入岛渲染/选中/拖拽/HMR 全实证（commit 063ecc07；CI 红两轮——file: 依赖需 workspace 预装预建 a9bf3672、YAML 标量 `file: ` 笔误 cd04cf62——修复后 run 32575625410 绿）；E3 会话往返切换 island 无重挂、状态保持、dispose/接受全局项成文（commit 77b1c86c，run 32575883252 绿）；E4 冷启动全链路冒烟通过（选中 + 拖拽精确位移，console 0/0，commit 2cc790de）；subagent 独立核验 V1-V8 全过「可以提交」（含 wasm sha256 双端一致、路径穿越四变体 404、exact pin 复核、HEAD CI run 32576137352 13/13 job 绿），[T15-verify](../../tasks/T15-verify.md) 由核验方就地重写
- **内容**：任务表 T15 行状态 🔄 → ✅ 完成；tasks/_index.md 镜像行同步
- **task 文档**：[tasks/T15-plan.md](../../tasks/T15-plan.md)
