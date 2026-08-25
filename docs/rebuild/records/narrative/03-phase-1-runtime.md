<!--
  写作纪律（改本文前必读）：
  - 本文是 03-phase-1-runtime.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/03-phase-1-runtime.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md)（一一对应）
> **身份**：本档案持有针对 03-phase-1-runtime.md 的腐烂/修正/核验记录。**runtime 选型决策（D7/D9/SP-1~4）全量归 `records/topics/agent-runtime.md`**——本档案留指针。

---

## 腐烂类（派生自 records/topics/docs-governance.md ROT-9）

## ROT-9 · 03 v1 pi sdk「有 AI SDK harness 适配器」作基线事实

- **派生自**：`records/topics/docs-governance.md` ROT-9
- **错误**：pi sdk「有 AI SDK harness 适配器」作基线事实
- **实况**：R4：本地无包无法证实
- **处置**：v2 降级【假设】；后续 SP-2 推翻（earendil-works/pi 本地有完整源码）

---

## 修正类

## 修正-3 · 03-phase-1-runtime.md v3 附录 A 迁移

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **派生自**：`records/topics/docs-governance.md` 修正-3
- **原文位置**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md)「附录 A：v3 相对 v2 的修订记录」
- **迁移去向**：`records/topics/agent-runtime.md` 修正-2 条目
- **影响**：03 附录 A 删除；03 头部加纪律块 + 统一 HH:MM

## 修正-2 · 03-phase-1-runtime.md v3 重写

- **派生自**：`records/topics/agent-runtime.md` 修正-2
- **内容**：范围缩减、X 路线深化、pi 路线深化、决策框架简化、身份声明更新、前置验证条目

---

## 核验类

## R4 · 03 前端契约 + dsh 实况

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent D
- **范围**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md) + dsh 本地仓库
- **结论**：前端 = @ai-sdk/vue Chat 类 + 自写 UIMessage stream v1 解析；dsh 实测：Cordis 插件、session 事件溯源、compaction 可替换 seam、ToolResultBlock 递归含 ImageBlock（适配器当前 text-only）、stdio 子进程嵌入、多 provider 实为 pi-ai@0.82.1；pi sdk 本地不可查 → 降级【假设】
- **影响**：03 已修正为 v2；后续 SP-2 推翻 pi sdk 不可查假设

---

## 修正-N · 03-phase-1-runtime.md T09 整改（数字对齐 + 引用修正 + 数据实采）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-20）
- **内容**：
  1. §2.2/§4.1 X 路线工作量「15.5 人日」（无源）→ ≈37-38 人日（对齐 records/topics/agent-runtime.md 修正-1 / SP-3 与 01 §8）
  2. §2.2 视觉回路证据：悬空引用 `weshop-dsh-plugin/src/integrations/pi.ts:18`（文件不存在）→ 替换为 pi 源码证据（openai-completions.ts:1284 + transform-messages.ts downgradeUnsupportedImages，2026-08-21 复核）
  3. §3.2 pi 路径标签 `packages/session/` → `packages/coding-agent/src/core/`（行号 1530 实测不变）
  4. §5.1 推荐方向不一致显式标注（「A 推荐」vs D9「c 推 1」；不改推荐本身，留 owner 拍板，链 D16）
  5. §5.2 前置验证实采填入（2026-08-21：dsh 175,615 stars / 周下载 648,007；pi 周下载 1,904,277；均超阈值）；无效命令 `npm view weekly-downloads` 改为 npm downloads API
- **影响**：D9 拍板材料齐备——数字一处口径、外部数据已采、两路线矛盾点全部显式化

## 修正-N · 03-phase-1-runtime.md §5.2/§5.3 修订（T10 启动登记）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-21
- **依据**：owner 拍板 D20（先合并 upstream + 双 spike 并行 S-pi 先行）
- **内容**：
  1. §5.3 spike 启动条件：「待 D9 拍板」→「已启动（D20）」——先 T10 合并，双 spike 登记 S-pi 先行，D9 待证据
  2. §5.2 pi GitHub stars 空格补测：94,558 / 11,699 / 134（`gh api repos/earendil-works/pi`，2026-08-21）
- **task 文档**：[tasks/T10-plan.md](../../tasks/T10-plan.md)

## 修正-N · 03-phase-1-runtime.md §5.4 新增（T13：dsh 版本钉扎与双周升级窗口）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-22
- **依据**：owner 拍板 D22（dsh 插件路线主线）后 T13 收口——dsh preview 颠簸实证（2026-08-10..21 共 10 个 rc，rc.1/rc.2 同日，npm view time 2026-08-22）需制度化版本纪律
- **内容**：新增 §5.4——主线钉扎 `@deepseek-ai/dsh@0.1.1-rc.1`（S-X 证据基准版本）；双周升级评估窗口（首窗 2026-09-05 所在周）；升级 = 独立 commit 且重跑 S-X 证据脚本（x3/x5/x6 + 7600 soak smoke）；安全修复例外需 owner 拍板记 records
- **task 文档**：[tasks/T13-plan.md](../../tasks/T13-plan.md)

## 修正-N · 03 §2.1 孤岛内容描述按 D23 修正（「编辑画布」→「完整编辑器」）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-23
- **依据**：owner 拍板 D23（[records/topics/agent-runtime.md](../topics/agent-runtime.md)）；§2.1 原描述「编辑画布 + 自写 ChatPanel + 工具面板」的「编辑画布」措辞与 owner 意图不符
- **内容**：§2.1 孤岛内容就地修正为「完整编辑器【画布 + 面板 chrome，D23 拍板取代原『编辑画布』措辞】 + 自写 ChatPanel + 工具面板」
- **task 文档**：[tasks/T17-plan.md](../../tasks/T17-plan.md)（登记提交随 T17 收口后决策，无独立任务）

## 修正-N · 03 §5.4 标题注记 D24（dsh 版本钉扎纪律随主线休眠）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-23
- **依据**：owner 拍板 D24（[records/topics/agent-runtime.md](../topics/agent-runtime.md)）——dsh-X 主线暂时搁置、pi SDK 路线升为主线；§5.4 的 dsh 版本钉扎纪律对象（dsh 主线）休眠
- **内容**：§5.4 标题补注「D24 后随 dsh 主线休眠，重启时恢复」，正文纪律本身不改（休眠非废除）
- **task 文档**：[tasks/T17-plan.md](../../tasks/T17-plan.md)（登记提交随 T17 收口后决策，无独立任务）

## 修正-N · 03 §3.2 skills 行勘误（pi skills 为内置，原述「无内置」误）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-23
- **依据**：owner 提出「pi skill 支持可后期引入别人 extension」后的复核——pi README.md:354-367 与 docs/extensions.md 实证 skills 内置（文件系统发现 + /skill 展开，Agent Skills 标准）；02 §P8 早有同结论，03 §3.2 摘要行与之矛盾，按详细证据文档为准；D24 第 5 条同误，已加补注
- **内容**：§3.2 skills 行就地勘误为「内置：四路径文件系统发现 + /skill:name 展开，零新代码」，标注勘误日期
- **task 文档**：[tasks/T17-plan.md](../../tasks/T17-plan.md)（登记提交随 T17 收口后决策，无独立任务）

## 修正-N · 03 新增 §5.5 pi 版本钉扎与升级窗口（T18 P1）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-23
- **依据**：D24 pi 升主线后需要与 dsh 对称的版本纪律（pi 周更，R-pi-1）；照 §5.4 模板成文；pin 0.84.2 三重依据（T11 证据基线 / npm 最新实测 / spikes-s-pi package.json 已锁）
- **内容**：新增 §5.5——pi 主线基准 0.84.2 精确钉扎（不用 ^/~ 与 dist-tag）、双周升级评估窗口（首窗 2026-09-05 所在周）、升级=独立 commit 且重跑 S-pi 全证据脚本（offline + T18 live）、安全修复例外需 owner 拍板
- **task 文档**：[tasks/T18-plan.md](../../tasks/T18-plan.md)

## 修正-N · 03 D24 终局同步 + 索引/行号/裸引用修正（2026-08-25 三方 review 整改）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-25
- **依据**：三方 review 发现——① §0/§5 仍按「选型待定」撰写，D24（2026-08-23 pi 升主线）终局未同步；② §6 索引「tracker.md D9 决策日志」为错误指针（tracker 无决策日志，D9 在 records/topics/agent-runtime.md）；③ §3.4 风险段「工具审批 / skills 需自写 extension」与 §3.2 skills 行 2026-08-23 勘误矛盾；④ §2.2 表 `constants.ts:347` 行号漂移（2026-08-25 grep 实测 :359）；⑤ §5.5「spikes/02 §3.4」与 §3.2「02 §P8」裸引用
- **内容**：§0 开头补 D24 终局宣告（对比内容保留作档案）；§5 标题改「已拍板：D24」+ §5.1 补拍板结论行；§6 索引改指 records/topics/agent-runtime.md D9/D22/D24；§3.4 风险行改为「工具审批需自写 extension；skills 内置」；constants.ts 行号 :347→:359 并附核验命令；两处裸引用补全文件名；头部时间刷新 + 硬门行改「已通过」
- **task 文档**：无独立 task（T26 统一登记）

## 修正-N · §4.4 承接 01 五条机制 + §6 索引两行修正 + 头部纯化（D30）

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-25
- **依据**：D30（01 三路线对比节删除，内容迁入 03，owner 2026-08-25）；决策登记见 [records/topics/docs-governance.md](../topics/docs-governance.md)
- **内容**：
  1. **新增 §4.4 X 复用更贵的五条机制**：自 01 原三路线对比节整体移植——复用基建清单 + 五条代价（SessionFace 桥 / 双框架 Vue↔React / 白名单 11 个 / preview 颠簸 / 孤岛化）+ 人日差【假设】指向 §4.1 矩阵口径
  2. **§6 文档关系索引两行修正**：「01-target-state.md §7 决策依据（三路线对比 + 当前推荐）」→「01-target-state.md §2 推进规划（Phase ↔ 层映射 + 验收主场指针）」；「01-target-state.md §8 X 复用更贵的五条机制」→「本文 §4.4（自 01 迁入，D30）」——删掉指向已删除章节的腐烂指针
  3. **头部纯化**：状态/时间字段 changelog 化内容删（状态：已核验 | 时间：2026-08-25 | 核验人：主 agent）；身份行改指 01 §2 推进规划主场
- **task 文档**：[tasks/T30-plan.md](../../tasks/T30-plan.md)
