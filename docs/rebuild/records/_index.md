<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4 + §4.10（D14）
-->

# records · 子文档索引（两层结构）

> **状态**：D15 重组（横向档案独立为 topics/） | **时间**：2026-08-28（§1 D 编号延展至 D37 + §2 tracker 行标注 D36 豁免——T37 决策批次登记；前次 2026-08-28：§2 绑定表补 zones.json 自愿绑定期行 + 计数 15→16 修正——T36 大扫除；前次 2026-08-25：§2 绑定表补 runbook/proposals 行 + §3 类型列修正；§1 D 编号规则改口——决策批 #7：全局 D 仅跨任务、任务内 Tk-Dn） | **核验人**：主 agent
> **身份**：变更/核验/腐烂记录的索引入口。**两层结构**——`narrative/` 物理绑定层（与文件 1:1）+ `topics/` 主题聚合层（跨文件横向档案）。**禁止混用**：横向档案不替代物理绑定层；物理绑定层不替代横向档案。详见 [05-process.md §4.10 D14](05-process.md)。
> **tracker.md 通过本文档找到具体记录**。

## 1. 编号规则

| 类型 | 前缀 | 规则 | 示例 |
|---|---|---|---|
| 决策 | `D`（全局）/ `T<k>-D<n>`（任务级） | 全局 D 唯一递增，**仅用于跨任务决策**；**任务内设计决策自 2026-08-25 起一律 Tk-Dn 命名**（如 T28-D1）——2026-08-25 owner 决策批 #7 拍板改口，解决任务级 D 与全局 D 撞名检索歧义（如 T24-plan D5 vs 全局 D5）。历史文档（T19-T25 plan 内的局部 D）**不回改**，自然触及时顺手改 | 全局：D1-D37（D16 已关闭；D25-D29 为 2026-08-25 补登，见 [topics/agent-runtime.md](topics/agent-runtime.md)；D30-D33 散见各 topics；**D34-D37 为 2026-08-28 owner 两批拍板**——D34/D35 见 [topics/ci-infra.md](topics/ci-infra.md)，D36/D37 见 [topics/docs-governance.md](topics/docs-governance.md)）；任务级：T22-D1、T24-D1、T25-D1 等（历史，不回改） |
| 核验 | `V` / `P0` / `SP` / `CI` | 按来源分前缀 | V1-V4, P0-1~P0-10, SP-1~SP-3 |
| 修正 | `修正-N` | 按被修正的记录编号或全局递增 | 修正-1, 修正-2 |
| 腐烂 | `ROT-N` | 全局递增 | ROT-1, ROT-2 |
| 合并 | `MERGE-N` | 按合并次数 | MERGE-1 |

## 2. narrative/ 物理绑定层（与文件 1:1）

**核心约束**（D14 §4.10）：每个被纳入文档治理范围的物理文件必须有自己的 `records/narrative/<file>.md`——文件名脱去 `.md` 后缀、连字符化（如 `00-why-rebuild.md` ↔ `records/narrative/00-why-rebuild.md`）。**一一对应**。

绑定范围（与 `tools/zone-registry/src/check/bindings.ts` 强制口径一致，2026-08-21 T09 修正）：叙事文档 `00-05` / `README.md` / `tracker.md` / `spikes/*.zh.md` / `proposals/*.md` 需要 narrative 绑定；`tasks/` 三件套走任务表路径检查（D15），**不入** narrative；`records/topics/` 横向档案与 `records/_index.md` 自身**不需要** narrative 绑定（[05-process.md §4.10](../05-process.md) T07 修正）。

| 物理文件 | narrative 绑定 |
|---|---|
| `docs/rebuild/00-why-rebuild.md` | `records/narrative/00-why-rebuild.md` |
| `docs/rebuild/01-target-state.md` | `records/narrative/01-target-state.md` |
| `docs/rebuild/02-phase-0.md` | `records/narrative/02-phase-0.md` |
| `docs/rebuild/03-phase-1-runtime.md` | `records/narrative/03-phase-1-runtime.md` |
| `docs/rebuild/04-porting-discipline.md` | `records/narrative/04-porting-discipline.md` |
| `docs/rebuild/05-process.md` | `records/narrative/05-process.md` |
| `docs/rebuild/README.md` | `records/narrative/README.md` |
| `docs/rebuild/tracker.md` | `records/narrative/tracker.md`（**D36 豁免**：2026-08-28 owner 拍板——高频活文档不再强制同 commit 追加，档案保留停更；bindings.ts 已配套） |
| `docs/rebuild/runbook-github-push.md` | `records/narrative/runbook-github-push.md` |
| `docs/rebuild/proposals/*.md` | `records/narrative/proposals/<file>.md`（现仅 governance-v1.md） |
| `docs/rebuild/spikes/*.zh.md` | `records/narrative/spikes/<file>.zh.md` |
| `tools/zone-registry/zones.json` | `records/narrative/zones.json.md`（自愿绑定，超出 bindings.ts 强制口径——zones.json 是登记信任根，T32 起为其单独立档） |

> 计数（2026-08-28 `find docs/rebuild/records/narrative -type f | wc -l` 实测 = **16**）：6 个核心叙事（00-05）+ README + tracker + runbook-github-push + zones.json + 5 个 spike + 1 个 proposal。（2026-08-25 口径 15 漏记 zones.json.md——T36 大扫除时发现并修正。）

## 3. topics/ 主题聚合层（横向档案）

**核心约束**：横向档案是**跨文件**的决策/核验/腐烂记录，按主题聚合——**不可替代**物理绑定层。`records/<对象>.md` 是主题聚类（覆盖多文件），**不构成**与单文件的绑定关系，必须有独立的 `records/narrative/<file>.md`。

| 对象 | 横向档案 | 主要记录类型 |
|---|---|---|
| agent 后端 / runtime | `topics/agent-runtime.md` | D7-D9（已闭环）、D20-D24、spike 选型（SP-1~SP-8） |
| brand config / type / profile | `topics/brand-config.md` | D1（参考图机制）、D2/D2a（vision 通道）、V2（实测） |
| ChatPanel / ChatInput | `topics/chat-ui.md` | D5（chatMode，T24 已事实落地）、D8、UI 相关决策与腐烂 |
| i18n 缝 / locale | `topics/i18n.md` | locale 删除、缝落位 |
| 营销工具 | `topics/tools-marketing.md` | V2（16 文件实测）等营销工具核验 |
| 生图管线 | `topics/tools-image-gen.md` | 生图独立凭证链（原 F0.3②，D32 归并 C3a） |
| upstream 合并 | `topics/upstream-merge.md` | MERGE-1、合并演习、合并 SOP |
| CI / workflows / zone registry | `topics/ci-infra.md` | CI-1~CI-13、P0-9/P0-10、D18 |
| spike 文档的核验与修正 | `topics/spikes.md` | SP-1~SP-3、修正-1 |
| 文档体系本身的修改 | `topics/docs-governance.md` | D10~D17、D19、P0-8、修正-N、ROT-N、治理冻结期提案 |

## 4. 子文档使用纪律

- **append-only**：所有 records 子文档（narrative/ + topics/）只增不改。已登记的事实是审计线索，不能被修改。如果后来发现错了，追加一条「修正-N」记录。
- **两层关系**：
  - narrative/ 物理绑定层：单文件腐烂/修正/核验记录（按 D14 §4.10）
  - topics/ 主题聚合层：跨文件决策/核验记录
  - 两层并存，不互相替代
- **交叉引用**：
  - 子文档之间引用用 `records/<path>.md §编号` 格式
  - 引用叙事文档用 `docs/rebuild/<file>.md §标题`
  - 引用任务档案用 `tasks/T<NN>-{plan,self-check,verify}.md §标题`（D15）
- **新对象新增子文档**：当某个主题首次出现决策/核验/腐烂时，新建 `topics/<topic>.md` 并在 §3 加一行
- **新物理文件新增 narrative**：物理文件首次纳入治理时，新建 `narrative/<file>.md` 并在 §2 加一行

## 5. 路径迁移说明（2026-08-21 · D15 + owner 提议）

- **从 `records/<topic>.md` → `records/topics/<topic>.md`**：横向档案独立文件夹（owner 提议"横向档案应该也独立成一个单独的文件夹"）
- **narrative/ 不动**：物理绑定层维持原地 `records/narrative/<file>.md`（§4.10 一一对应纪律）
- 所有旧引用 `records/topics/agent-runtime.md` 形式同步更新为 `records/topics/agent-runtime.md`
