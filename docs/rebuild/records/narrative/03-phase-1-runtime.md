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
