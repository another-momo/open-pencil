<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records · 子文档索引

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：变更/核验/腐烂记录的索引入口，所有子文档 append-only，tracker.md 通过本文档找到具体记录。

## 1. 编号规则

| 类型 | 前缀 | 规则 | 示例 |
|---|---|---|---|
| 决策 | `D` | 全局唯一递增 | D1, D2, D2a, D3... |
| 核验 | `V` / `P0` / `SP` / `CI` | 按来源分前缀 | V1-V4, P0-1~P0-10, SP-1~SP-3 |
| 修正 | `修正-N` | 按被修正的记录编号或全局递增 | 修正-1, 修正-2 |
| 腐烂 | `ROT-N` | 全局递增 | ROT-1, ROT-2... |
| 合并 | `MERGE-N` | 按合并次数 | MERGE-1 |

## 2. 子文档列表

| 对象 | 文件 | 主要记录类型 |
|---|---|---|
| agent 后端 / runtime | `agent-runtime.md` | D7-D9、D9 修正、spike 选型 |
| brand config / type / profile | `brand-config.md` | D1（参考图机制）、V2（实测） |
| ChatPanel / ChatInput | `chat-ui.md` | UI 相关决策与腐烂 |
| i18n 缝 / locale | `i18n.md` | locale 删除、缝落位 |
| 营销工具 | `tools-marketing.md` | D5（chatMode）、V2（16 文件） |
| 生图管线 | `tools-image-gen.md` | F0.3② 凭证链 |
| upstream 合并 | `upstream-merge.md` | MERGE-1、合并演习、合并 SOP |
| CI / workflows / zone registry | `ci-infra.md` | CI-1~CI-5、P0-9/P0-10 |
| spike 文档的核验与修正 | `spikes.md` | SP-1~SP-3、修正-1 |
| 文档体系本身的修改 | `docs-governance.md` | R1-R4 核验、P0-8、修正-2、ROT-N |

## 3. 子文档使用纪律

- **append-only**：子文档只增不改。已登记的事实是审计线索，不能被修改。如果后来发现错了，追加一条「修正-N」记录。
- **交叉引用**：子文档之间引用用 `records/<name>.md §编号` 格式；引用叙事文档用 `docs/rebuild/<file>.md §标题`。
- **新对象新增子文档**：当 records/_index.md §2 表里没有的新对象出现决策/核验/腐烂时，新建对应子文档并在 §2 加一行。