<!--
  写作纪律（改本文前必读）：
  - 本文是外部建议（proposal）— append-only，仅追加条目；不接受删除原条目
  - 采纳映射：本文件的落地决策登记在 records/topics/docs-governance.md 的 D10/D11/D12/D13/D14/D15
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 重建文档体系优化方案（proposal · 外部建议）

> **状态**：已采纳（v1）
> **时间**：2026-08-20 18:00 草稿 → 2026-08-21 内化到 `docs/rebuild/proposals/governance-v1.md`
> **作者**：主 agent + owner 讨论产出
> **来源**：Phase 0 完成后 review 中发现的文档治理问题，经三轮讨论收敛为此方案
> **身份**：**外部建议**（proposal）——对 [docs/rebuild/05-process.md](../05-process.md) 的增量修改建议，不是替代。**append-only**：原条目不接受删除/修改；后续落地以新条目追加。
> **采纳映射**：D10 / D11 / D12 / D13 / D14 / D15 — 详见 [`records/topics/docs-governance.md`](../records/topics/docs-governance.md)
> **承载 task**：[tasks/T01-plan.md](../tasks/T01-plan.md)（T01 文档体系整改 / proposal 落地）/ [tasks/T02-plan.md](../tasks/T02-plan.md)（T02 §5 迁移 + check-tasks 增强）/ [tasks/T03-plan.md](../tasks/T03-plan.md)（T03 05 §4.10 一一对应补漏）/ [tasks/T04-plan.md](../tasks/T04-plan.md)（T04 D15 三件套物理拆分 + topics/ 重组）

---

## 1. 问题诊断

Phase 0 review 发现当前文档体系（05-process.md §4 六条纪律）存在四类结构性缺陷：

### 1.1 计划修正没有定义

02-phase-0.md 的 §0「执行期修正」在文档顶部放了 8 条修正，但原文（§2/§3/§5）已同步改成新版本。产生双轨阅读体验：§0 解释为什么改了，§2/§3 展示改后的结果，读者必须同时读两处才能理解全貌。更根本的问题：05-process.md §4 根本没有定义「计划被实测推翻时，文档应该怎么改」。

### 1.2 纪律不可见

05-process.md 定义了六条写作纪律，但 agent 写文档时不知道它的存在，或者知道但不会主动去看。纪律存在于一个独立文件里，和实际写作行为脱节。

### 1.3 tracker 会膨胀

tracker.md 当前 106 行，包含阶段门、决策日志、任务表、WIP 审判、核验日志、腐烂记录 6 类信息。随着 Phase 1 推进会持续膨胀，且不同类信息混在一起，查找困难。

### 1.4 交叉引用脆弱

文档间大量使用 `05 §4`、`02 §5` 这样的裸 § 编号引用。§ 编号会因增删段落而漂移，导致引用失效。且裸 § 编号对读者和 agent 都含义不明。

---

## 2. 方案设计

### 2.1 计划修正规则（05 §4 补充第 7 条）

**原则：叙事文档是快照，不是日志。变更历史是 tracker 的职责。**

> **7. 计划修正**：当执行实测推翻文档中的计划/假设时：
> 1. 叙事文档（00-04）**直接改成新版本**，不加修正节、不加 blockquote、不保留旧方案痕迹。
> 2. 修正的完整记录记入 `records/` 子文档：决策类记入对应对象的决策记录，事实类记入对应对象的核验记录。
> 3. 叙事文档的状态字段在修正后**必须刷新**（降为「草稿」待下次核验，或重新标注核验日期）。
> 4. 旧方案如果值得保留（如否决的理由将来可能被重新评估），在 records 子文档中用一条记录保留，不回填到叙事文档。

**为什么不选「blockquote 内嵌」方案**：blockquote 堆叠随文档增长而恶化，且 blockquote 本身也会腐烂。方案 A 的成本恒定——不管文档 100 行还是 1000 行，修正操作都是「改原文 + 在 records 记一条」。且从一开始就建立这个纪律，比将来切换容易。

### 2.2 纪律提示块（05 §4 补充第 8 条）

> **8. 纪律提示块**：每个叙事文档（00-04）的前 15 行必须包含纪律提示块。格式为 HTML 注释（源码可见，渲染不可见）：

```html
<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->
```

**为什么用 HTML 注释**：blockquote 给读者看（增加阅读噪音），HTML 注释给写的人看（源码可见，渲染不可见）。agent 编辑文件时一定能看到前几行的注释。

**05-process.md 自身也需要**：

```html
<!--
  本文是过程定义，优先级最高。修改本文时：
  - 修改后在 records/docs-governance.md 登记为决策
  - 本文格式也必须遵守下方纪律
-->
```

### 2.3 tracker 拆分：按被修改对象分，不按类型分

**原则：当你关心某个对象时，所有关于它的记录都在一个地方。**

```
docs/rebuild/
├── tracker.md                    # 总索引 + 阶段门 + 任务表（≤50 行）
└── records/
    ├── _index.md                 # 子文档索引 + 编号规则
    ├── agent-runtime.md          # agent 后端 / runtime 相关
    ├── brand-config.md           # brand config / type / profile
    ├── chat-ui.md                # ChatPanel / ChatInput / 聊天界面
    ├── i18n.md                   # i18n 缝 / locale
    ├── tools-marketing.md        # 营销工具
    ├── tools-image-gen.md        # 生图管线
    ├── upstream-merge.md         # upstream 合并记录
    ├── ci-infra.md               # CI / workflows / zone registry
    ├── docs-governance.md        # 文档体系本身的修改
    └── ...                       # 随 Phase 推进新增
```

**子文档内部用标签区分记录类型**：

```markdown
# records/brand-config.md

## D2 · vision 通道 B 去留

- **类型**：决策
- **时间**：2026-08-20 16:45
- **拍板**：owner
- **内容**：B 为默认（不进主 agent 上下文）
- **理由**：R2 实测：双份视觉回路 + 独立凭证是旧仓奠基代码...

## V2 · brand config 实测核验

- **类型**：核验
- **时间**：2026-08-18 10:30
- **核验人**：subagent B
- **内容**：7 type + 8 profile，config.yaml 303 行
- **验证命令**：`ls public/default-brand/config.yaml && wc -l`

## 修正-1 · spike 01 工作量上修

- **类型**：修正
- **时间**：2026-08-20 17:20
- **依据**：SP-3 weshop 案例实证
- **内容**：X 路线工作量 ≈33 → ≈37-38 人日
```

**编号规则**：

| 类型 | 前缀 | 规则 | 示例 |
|---|---|---|---|
| 决策 | `D` | 全局唯一递增 | D1, D2, D2a, D3... |
| 核验 | `V` / `P0` / `SP` / `CI` | 按来源分前缀 | V1-V4, P0-1~P0-10, SP-1~SP-3 |
| 修正 | `修正-N` | 按被修正的记录编号 | 修正-1 |
| 腐烂 | `ROT-N` | 全局递增 | ROT-1, ROT-2... |
| 合并 | `MERGE-N` | 按合并次数 | MERGE-1 |

**子文档只增不改**（append-only）。已登记的事实是审计线索，不能被修改。如果后来发现错了，追加一条「修正-N」记录。

**tracker.md 精简为索引**：

```markdown
# tracker · 重建跟踪表

> 详细记录见 records/ 子文档。更新纪律见 05-process.md §4。

## 1. 阶段门

| 阶段 | 出口标准 | 状态 | 完成 | 签字 |
|---|---|---|---|---|
| Phase 0 | 02-phase-0.md §5 六条 | ✅ | 2026-08-19 | 待 owner |
| Phase 1 | ... | ⬜ | — | — |

## 2. 任务表

| 块 | 内容 | 验收 | 状态 | PR | 记录 |
|---|---|---|---|---|---|
| F0.1 | runtime 内核薄切 | hello-tool | ⬜ | — | records/agent-runtime.md |
| C2a | brand 服务 | 端到端 | ⬜ | — | records/brand-config.md |

## 3. 记录索引

| 对象 | 文件 |
|---|---|
| agent runtime | records/agent-runtime.md |
| brand config | records/brand-config.md |
| ... | ... |
```

### 2.4 文档头部元信息统一格式

当前 6 个文档的头部格式各不相同（有的有「身份」，有的没有；状态字段格式不统一）。建议统一为：

```markdown
# XX · 标题

<!-- 纪律提示块 -->

> **状态**：已核验 | **时间**：2026-08-20 14:30 | **核验人**：R1-R4 subagent
> **身份**：[一句话说明本文档在决策链中的角色]
> **基线**：[可选，测量点或供货方信息]
```

**字段定义**：

| 字段 | 必填 | 含义 | 取值 |
|---|---|---|---|
| 状态 | ✅ | 文档当前信任等级 | `草稿` / `已核验` / `已执行` / `已过期` |
| 时间 | ✅ | 最后核验/执行时间 | `YYYY-MM-DD HH:MM`（本地时间，24h 制） |
| 核验人 | ✅ | 谁核验的 | `subagent A-D` / `主 agent` / `owner` / `CI` |
| 身份 | ✅ | 决策链角色 | 见 README.md 身份表 |
| 基线 | 可选 | 测量点/commit hash | 视内容而定 |

**时间精度说明**：本项目一天内可能有多轮提交、多次核验、多轮讨论。仅精确到日期无法区分同一日内的先后顺序。统一使用 `YYYY-MM-DD HH:MM` 格式（如 `2026-08-20 14:30`），确保同日事件可排序。check-docs.ts 的日期正则兼容纯日期格式（`YYYY-MM-DD`），但鼓励新格式。

**状态值语义**：

| 状态 | 含义 |
|---|---|
| `草稿` | agent 新写，未被核验 |
| `已核验` | 经核验，事实准确 |
| `已执行` | 描述的 phase 已执行完成（可与「已核验」并存） |
| `已过期` | 已被后续版本取代，归档但不删除 |

### 2.5 交叉引用格式（05 §4 补充第 9 条）

> **9. 交叉引用格式**：文档间引用必须使用 `文件名.md §N 标题` 格式。禁止使用无文件名的纯 § 编号引用。

| 当前写法 | 正确写法 |
|---|---|
| `05 §4` | `05-process.md §4 文档纪律` |
| `02 §5` | `02-phase-0.md §5 验收标准` |
| `tracker §2` | `records/_index.md` 或具体对象文件 |
| `tracker §5` | `tracker-verification.md`（拆分后） |

---

## 3. 自动化检查机制

### 3.1 格式校验脚本（check-docs.ts）

检查文档是否遵守格式纪律——确定性规则，不需要 AI 理解内容。挂进 CI 的 push 触发（当前 ci.yml 已有 push trigger scoped to `rebuild/**` branches），每次 push 自动跑：

```typescript
// tools/zone-registry/src/check-docs.ts（建议挂进 CI 或 check:zones 旁边）

interface LintRule {
  name: string
  applies: (filePath: string) => boolean  // 是否适用于该文件
  check: (filePath: string, content: string) => string[]
}

const rules: LintRule[] = [
  {
    name: 'metadata-status',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      if (!/\*\*状态\*\*：/.test(c)) return ['缺少 **状态** 字段']
      return []
    }
  },
  {
    name: 'metadata-date',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      const m = c.match(/^\*\*时间\*\*：.+$/m)
      if (m && !/\d{4}-\d{2}-\d{2}/.test(m[0])) return ['时间字段缺少日期']
      return []
    }
  },
  {
    name: 'metadata-identity',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      if (!/\*\*身份\*\*：/.test(c)) return ['缺少 **身份** 字段']
      return []
    }
  },
  {
    name: 'discipline-header',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      const head = c.split('\n').slice(0, 15).join('\n')
      if (!head.includes('写作纪律') && !head.includes('纪律提示'))
        return ['前 15 行缺少纪律提示块']
      return []
    }
  },
  {
    name: 'cross-reference-format',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      const violations: string[] = []
      // 匹配「数字 + § + 数字」但不匹配「文件名.md §」
      for (const m of c.matchAll(/(?<!\.md\s)§\d+/g)) {
        violations.push(`裸 § 引用「${m[0]}」应改为「文件名.md §N 标题」`)
      }
      return violations
    }
  },
  {
    name: 'fact-verify-command',
    applies: (p) => /docs\/rebuild\/0[0-4]/.test(p),
    check: (_, c) => {
      const lines = c.split('\n')
      const violations: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('【事实】')) {
          const nearby = lines.slice(i, i + 4).join(' ')
          if (!nearby.match(/`[^`]+`/) && !/\d{4}-\d{2}-\d{2}/.test(nearby))
            violations.push(`第 ${i + 1} 行【事实】声明缺少验证命令或时间`)
        }
      }
      return violations
    }
  }
]
```

**能拦截的腐烂类型**：

| 检查项 | 拦截什么 | 成本 |
|---|---|---|
| 状态字段缺失 | 文档过期无人知 | 极低 |
| 时间字段缺失 | 不知道信息多旧、无法排序同日事件 | 极低 |
| 身份字段缺失 | 不知道文档角色 | 极低 |
| 纪律提示块缺失 | agent 写文档时看不到纪律 | 极低 |
| 裸 § 引用 | 引用失效、含义不明 | 极低 |
| 事实无验证命令 | 声明无法核验 | 低 |

### 3.2 强制核验机制（gate review 时 subagent 执行）

格式校验是日常防线（每次 push 跑），内容核验是关键节点防线（gate review 时跑）。

**gate review 标准动作（不可跳过）**：

1. CI 全绿（已自动化）
2. zone check 全绿（已自动化）
3. **文档格式校验全绿**（check-docs.ts，已自动化）
4. **subagent 文档核验**：对当前 phase 相关文档中的所有可检查声明，逐条验证，结果记入 records/ 对象子文档。核验不通过的阻塞 gate。

**第 4 步是 gate 的硬性前置条件**——不跑核验就不能过 gate。这解决了「主 agent 忘记排 subagent」的问题：因为 gate review 的 checklist 里写死了这一步，跳不过去。

**subagent 核验范围（不限于数字）**：

subagent 应该验证**所有机械可检查的声明**，包括但不限于：

| 声明类型 | 示例 | 验证方式 |
|---|---|---|
| 数字 | 「14 文件」「7 type + 8 profile」 | `ls \| wc -l`、`grep \| wc -l` |
| 文件/路径存在性 | 「src/components/L3/ 不存在」 | `ls` / `test -e` |
| API 存在性 | 「mergeLocaleMessage 不存在」 | `grep -r` 在源码中搜索 |
| 依赖关系 | 「对 AI SDK 的耦合仅两个 import」 | `grep` 统计 import |
| 行为描述 | 「前端每次发全量 messages 到 /v1/chat」 | 读代码确认 |
| 配置事实 | 「workspaces 含 -packages/docs」 | `cat package.json \| jq` |

核心原则：**凡是能用命令+代码得到「对/错」结论的声明，都应该被核验**。

**subagent 核验 prompt 模板**：

```markdown
你是只读核查 agent。任务：核验指定文档中的所有可检查声明。

步骤：
1. 读取目标文档，提取所有可检查声明：
   - 【事实】声明（附带验证命令和日期的）
   - 数字声明（含具体计数的）
   - 路径/文件存在性声明
   - 依赖关系声明
   - API 存在性声明
2. 对每条声明，运行验证命令或读取相关代码
3. 比对声明值与实测值
4. 输出报告：
   - ✅ 通过：声明值 = 实测值
   - ❌ 失败：声明值 ≠ 实测值（附实测值）
   - ⚠️ 无法验证：命令不可执行或路径不存在

不修改任何文件。只读。
```

**核验结果的记录位置**：每条核验结果记入对应的 records/ 对象子文档。格式：

```markdown
## 核验 · Phase 0 文档（2026-08-20 16:00）

- **类型**：核验
- **核验人**：subagent A
- **范围**：00-why-rebuild.md, 02-phase-0.md
- **结果**：15/15 通过，0 失败，0 无法验证
- **逐条**：
  - ✅ 00 §3 营销工具 14 文件 → `ls | wc -l` = 14
  - ✅ 02 §5 deleted 951 → `git diff --name-only | wc -l` = 951
  - ...
```

### 3.3 核验提醒机制

仅靠 gate review 时的 checklist 不够——gate review 是事后检查，而核验应该在过程中执行。需要在多个触点提醒主 agent：

| 触点 | 位置 | 具体形态 |
|---|---|---|
| **phase 文档验收标准** | 02-phase-0.md §5、03-phase-1-runtime.md 等 | 验收标准加一条硬性门槛：「subagent 文档核验全绿」 |
| **05-process.md gate 流程** | §3.1 gate review 标准动作 | 列为第 4 步，标注「不可跳过」 |
| **tracker 任务表** | tracker.md 任务表 | 加一列「核验」，标记是否已跑 subagent 核验 |
| **upstream 合并 SOP** | 05-process.md §3.3 | 合并后必须跑 check-docs.ts + 排 subagent 核验受影响文档 |
| **文档顶部纪律提示块** | 00-04 每个文档 | 提示「改完后...gate review 时需 subagent 核验」 |

最关键的是**第一个**——phase 文档的验收标准。当前 02 的验收标准是 6 条，加一条变为 7 条：

> 7. ✅ 文档核验：当前 phase 相关叙事文档中的所有可检查声明，经 subagent 逐条验证全绿（结果记入 records/ 对象子文档）。

有了这条，主 agent 在准备过 gate 时**不得不**排 subagent——这是验收的硬性前置条件，跳不过去。

### 3.4 触发时机

| 时机 | 谁触发 | 核验什么 |
|---|---|---|
| gate review（阶段转换） | 主 agent 必须执行 | 当前 phase 文档的所有可检查声明 |
| upstream 合并后 | 主 agent 必须执行 | 合并影响到的文档中的路径/数字声明 |
| push 到远端后 | CI 自动 | 本次修改文档的格式合规（check-docs.ts） |
| 决策拍板后 | 主 agent | 对应文档是否已更新为新版本 |

---

## 4. 现有文档的存量整改

方案落地时需要对现有文档做一轮整改：

| 文档 | 整改内容 |
|---|---|
| 00-why-rebuild.md | 加纪律提示块；统一头部格式（日期补时间）；将 §0 的修正理由迁移到 records/ 对象子文档（按方案 2.1 删掉 §0） |
| 01-target-state.md | 加纪律提示块；统一头部格式（日期补时间） |
| 02-phase-0.md | 加纪律提示块；统一头部格式（日期补时间）；**删除 §0 执行期修正节**（修正内容已体现在 §2/§3/§5，§0 的历史记录迁移到 records/ 对象子文档）；验收标准加第 7 条（subagent 文档核验） |
| 03-phase-1-runtime.md | 加纪律提示块；统一头部格式（日期补时间） |
| 04-porting-discipline.md | 加纪律提示块；统一头部格式（日期补时间） |
| 05-process.md | 加纪律提示块；补充第 7/8/9 条规则；全文扫描裸 § 引用并修正；gate review 流程加第 4 步 |
| tracker.md | 拆分为索引 + records/ 子文档 |
| README.md | 更新文档结构描述（反映 records/ 新增） |

---

## 5. 实施顺序

| 步骤 | 内容 | 成本 | 前置 |
|---|---|---|---|
| 1 | 05-process.md 补充第 7/8/9 条规则 + gate review 加第 4 步 | 0.5h | 无 |
| 2 | 所有叙事文档加纪律提示块 + 统一头部格式（含时间精度） | 1h | 步骤 1 |
| 3 | 02-phase-0.md 删除 §0，迁移记录到 records/；验收标准加第 7 条 | 1h | 步骤 1 |
| 4 | tracker.md 拆分为索引 + records/ 子文档 | 2h | 步骤 1 |
| 5 | 写 check-docs.ts 格式校验脚本 | 0.5d | 步骤 2 |
| 6 | 全文扫描裸 § 引用并修正 | 0.5h | 步骤 1 |

总计约 1.5-2 人日。步骤 1-4 可以在一个 commit 里完成（纯纪律层面，不改实质内容）。步骤 5 单独一个 commit（新增脚本）。步骤 6 随步骤 1-4 一起。
