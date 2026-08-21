<!--
  写作纪律（改本文前必读）：
  - 本文是 README.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/README.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[README.md](../../README.md)（一一对应）
> **身份**：本档案持有针对 README.md 的修改记录。README 是入口文档，本身不直接腐烂。

---

## 修正类

## 修正-1 · README.md 重组（records/ 二级目录）

- **类型**：修正（按对象：README.md）
- **时间**：2026-08-20 19:30（本改进项）
- **内容**：原 records/ 11 个对象子文档重组为 records/narrative/ + 横向档案结构
- **影响**：[README.md](../../README.md) §「真相分层与冲突裁决」+ §「第二层」表格需更新（同步本改进项）

---

## 核验类

## 整改后核验（2026-08-20）

- **类型**：核验
- **时间**：2026-08-20 18:30
- **核验人**：主 agent + owner
- **结论**：[README.md](../../README.md) v2 反映 records/ 子文档结构；本次整改补 README 重组

---

## 修正-N · README.md 引用路径迁移（topics/ 重组）

- **类型**：修正（按对象：README.md）
- **时间**：2026-08-21
- **依据**：本轮整改 D15 + owner 提议（横向档案独立为 records/topics/）
- **内容**：[README.md](../../README.md) 内部对横向档案（agent-runtime / brand-config / chat-ui / i18n / tools-marketing / tools-image-gen / upstream-merge / ci-infra / spikes / docs-governance）的引用路径从 `records/<topic>.md` 更新为 `records/topics/<topic>.md`
- **影响**：[README.md](../../README.md) 现引用 `records/topics/` 路径，与 [_index.md §3 主题聚合层列表](_index.md) 一致

## 修正-N · README.md v2（T07 整改：第二层列表简化 + 高频腐烂防御）

- **类型**：修正（按对象：README.md）
- **时间**：2026-08-21
- **依据**：T07 owner 反馈（README.md 第二层 11 行表高频腐烂）
- **原内容**：第二层 11 行"对象 → 文件"详细表（agent-runtime / brand-config / chat-ui / ...），每次新加横向档案都需同步更新
- **新内容**：简化为"两层结构"概述（narrative/ 物理绑定层 + topics/ 主题聚合层）+ 指向 [`records/_index.md`](../../_index.md) 作为权威列表 + "高频腐烂防御"标注
- **影响**：
  - README.md 不再高频腐烂于横向档案变更
  - 横向档案列表的唯一真源是 `_index.md`，避免多文档重复维护

## 修正-N · README.md gate 步骤号 + CI 声称修正（T09）

- **类型**：修正（按对象：README.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-15/ROT-19）
- **内容**：「gate review 硬性第 4 步」→ 第 6 步（subagent 核验实际位置）；「check-docs.ts 已挂 CI」→ 准确表述（check/docs.ts；T09 起 rebuild-discipline job 真正接线，附 CI-6 指针）

## 修正-N · README.md 步骤号二轮修正（T09 核验轮 N2）

- **类型**：修正（按对象：README.md）
- **时间**：2026-08-21
- **依据**：T09 核验 subagent 发现 N2——一轮修正只改了正文 gate 条目（第 6 步），第一层表格行（README.md L29）仍残留「§3.1 gate review 第 4 步」
- **内容**：第一层表格 05-process.md 行「第 4 步」→「第 6 步」；至此 README 两处步骤号引用均与 [05-process.md §3.1](../../05-process.md) 实际一致
- **教训**：同一文档内多处引用同一事实时，修正必须全文 grep 兜底（本轮漏改即为「改了正文没改表」）
