<!--
  写作纪律（改本文前必读）：
  - 本文是 04-porting-discipline.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/04-porting-discipline.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[04-porting-discipline.md](../../04-porting-discipline.md)（一一对应）
> **身份**：本档案持有针对 04-porting-discipline.md 的核验记录。04 是 Phase 2+ 操作纪律，本身不直接腐烂。

---

## 核验类

## R1-R4 · 综合

- **时间**：2026-08-18 14:00
- **核验人**：subagent A-D + 主 agent
- **范围**：[04-porting-discipline.md](../../04-porting-discipline.md) v1
- **结论**：建立。无具体腐烂记录，证据已在 00/01/02/03 各自的核验中体现

---

## 修正-N · 04-porting-discipline.md §4「逐块 PR」对齐 T08 决策（T09）

- **类型**：修正（按对象：04-porting-discipline.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-21）
- **内容**：§4「逐块 PR，PR 描述注明能力块编号」→「逐块 commit，commit message 注明能力块编号与验收测试」（docs/rebuild 范围不采用 PR 管理，T08 决策的边界显式化到移植阶段）

## 修正-N · 04 头部裸 § 引用修正（2026-08-25）

- **类型**：修正（按对象：04-porting-discipline.md）
- **时间**：2026-08-25
- **内容**：头部时间字段内「§4『逐块 PR』对齐 T08」裸引用补全为 04-porting-discipline.md §4；头部时间刷新为 2026-08-25（注明最近实质修改仍为 2026-08-21 T09）
- **task 文档**：无独立 task（T26 统一登记）

## 修正-N · 文档纪律轮（头部纯化 + 引用改号 + 测试规约行口径同步 + §4 登记规则 D31 口径 + F0.3② 标签改指 C3a）

- **类型**：修正（按对象：04-porting-discipline.md）
- **时间**：2026-08-25
- **依据**：D31（04/05 文档纪律轮，owner 2026-08-25）+ D32（F0.3② 归并层 1 C3a）；决策登记见 [records/topics/docs-governance.md](../topics/docs-governance.md)
- **内容**：
  1. **头部纯化**：状态字段 changelog 化时间纯化（状态：已核验 | 时间：2026-08-25 | 核验人：主 agent）
  2. **§3 次序 4 处 01 引用改号**（01 重编号同步）：§2 层 0→§3、§3→§4、§4→§5、§7→§8
  3. **测试规约行注意列补口径同步**：「『16 文件移植全绿』验收口径 2026-08-25 已废止（宿主随 T10 消失），层 1 验收改按 01-target-state.md §4 五环冒烟口径」
  4. **§4 移植操作约定登记规则改 D31 口径**：「[tracker.md §2 任务表](tracker.md) 登记一行」→「任务登记 = tasks/_index.md §2 逐任务永久行（三件套路径列，真源）+ tracker.md §2 当前任务行（收口后并入分组行，D31）」
  5. **F0.3② 标签改指 C3a**（D32）：移植清单「marketing app 层」行「settings 含生图凭证链（F0.3②）」→「（C3a 生成环组件，D32）」；「生图凭证 UI」行「F0.3② 的一部分」→「C3a 生成环组件（凭证与工具同阶段开发，D32）」
- **task 文档**：[tasks/T30-plan.md](../../tasks/T30-plan.md)

## T32 修正-N（2026-08-26） · §5「owned/follow/tarball 三态边界判定」新增

- 改动：`docs/rebuild/04-porting-discipline.md` 在 §4「移植操作约定」后新增 §5 整段，含 5.1 判定规则 / 5.2 tarball 与本地改动互斥规则 / 5.3 上游改名处理 / 5.4 反例警示。
- 理由：T31 上游合并第二轮的 zones.json 登记存在 24+18=42 处 byte 一致错位 + 5 处自有 ownedFile 缺 patch 溯源——根因是 check.ts 框架没有结构化的三态判定文档。T32 把"owned/follow/tarball 三态边界"提升为永久纪律。
- 详见：[tasks/T32-plan.md §3 S6](../../tasks/T32-plan.md)

## T32 修正-N（2026-08-26） · §3 次序引用号同步

- 改动：04 §3 次序段 4 处 01-target-state.md 引用改号同步（§2 层 0 → §3 / §3 → §4 / §4 → §5 / §7 → §8），与 D30/D31 整合一致。
- 备注：本档案前次已记录的「§3 次序改号」与本次 T32 一并覆盖；详见 [records/narrative/04-porting-discipline.md 之前 ROT 条目](../../records/narrative/04-porting-discipline.md)。

## T32 收口评审修正-N（2026-08-26） · §5.2 drift 处置从 warn 改判红（F1）

- 改动：`docs/rebuild/04-porting-discipline.md` §5.2 与 `tools/zone-registry/src/check.ts` `checkDriftTarball` 同步——tarball 文件本地 byte 与 base 不一致时**判红**（violation），不再 warn。
- 理由：初版 warn 不阻断等于把 tarball 文件的未登记修改从 T31 前的红灯降成警告、削弱门禁；实测升红时 44 个 tarball path 零 drift，无副作用。单一职责：tarball 文件的修改由 drift 检查判红，checkModified 不再重复报。
- 同批订正：checkGhostDeleted 注释去除已废弃的 P103 引用、zones.json $comment 补 upstreamMergeTarball 语义与 P62-P82/P83-P97 缺号说明。
