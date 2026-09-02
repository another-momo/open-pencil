# T85 plan——资产 references 按需读取机制 + editable-design mode 移植

> **立项**：2026-09-02 owner 拍板方向「给 workflow 像 skill 一样的按需 read reference
> 能力，替代 skill 系统」——skill 系统提案（父仓 docs/TodoProposals/202609020000-agent-skill-research.md）
> 整体搁置；本任务 = 机制 + 首个消费者（editable-design 移植，源文件在父仓
> `参考项目/Editable-Design/skills/editable-design/`，SKILL.md 605 行 + references 7 个）
> 一批落地。核实结论：15 个引用工具全部存在；移植不被 skill 系统硬阻塞。

## §1 定谳（机制契约）

### 定谳 1（frontmatter 契约）：三类资产统一可选 `references` 字段

```yaml
references:
  - path: references/imagery.md      # 相对资产文件所在目录；仅 .md；禁 .. / 绝对路径 / 盘符
    description: 图像资产决策与生成纪律   # 非空
```

- base / workflow / profile 三类统一（types.ts `StudioAssetReference` 单源——
  test:type-shapes 门禁禁同构双写，测试 fixture 一律 import 此型）。
- 校验（studio/validate.ts）：path 非空 + 相对 + 无 `..` + 无绝对/盘符 + .md 结尾；
  description 非空。**文件存在性**在 registry 加载期检查（validate 纯函数不碰 fs），
  缺失 → `failures[]` 显式条目（S2 §8 纪律：失败文件 + 原因 + 修复指引，不静默）。
- registry 解析后内部持有解析绝对路径（供 read_reference 使用）；**绝对路径不进
  manifest 投影**（T45 脱敏纪律延伸，同 failures.path 相对路径口径）。

### 定谳 2（目录约定）：references 与资产同侧按资产分目录

workflow `editable-design.md` 的 references 放 `studio/workflows/editable-design/references/`。
**前置核实项**：registry 的 `listMarkdownFiles` 若递归扫描，references 目录里的 .md
会被误注册为 workflow——工人先读 registry.ts 确认扫描深度；若递归，则改用
`studio/references/<asset-id>/` 布局并在 plan 偏差里记录。无论哪种，扫描器不得把
reference 文件当资产注册（加钉扎测试）。

### 定谳 3（索引注入）：active 资产的 references 索引追加进 systemPrompt 尾段

assembleTurn（active-design-host.ts）：本回合 active 资产（base 恒在 + 落盘 mode 的
workflow + 选中 profile）的 references 并集非空时，joinSegments 尾追加一节：

```
## 按需参考（read_reference 工具按需读取）
- references/imagery.md —— 图像资产决策与生成纪律（workflow: editable-design）
```

- 只列 active 资产的（mode 作用域隔离，不污染其他 mode 上下文；prefix 缓存友好——
  同 mode 回合间该段稳定）。空槽 = base only，base 有 references 才出现该节。
- profile/base 的 references 同机制（本任务不含它们的实例，只留机制）。

### 定谳 4（read_reference 工具）：后端本地工具，声明即白名单

- 新文件 `src/app/ai/pi-backend/read-reference.ts`：`createReadReferenceTool(deps)` 工厂
  返回 pi AgentTool（ask-user-question.ts 同款形态——本地执行、不过桥、无凭证）。
- 参数 `{ path: string }`。允许集 = **本回合 active 资产声明的 references 并集**
  （宿主持有每回合 allowed set——assembleTurn 计算，host 挂载，finalizeTurn 复位，
  同 intentConfirmed 一次性态纪律）。
- 命中 → 读文件返回全文（大小上限 50KB，超出截断 + 尾部注明截断）；
  未命中/未声明 → 结构化错误列出本回合可读 path 清单；`..` 在 validate 与读取双侧拒
  （纵深防御）。`noTools: 'builtin'` 不变——pi 内建 read 保持禁用，这是唯一读取缝。
- 装配：service.ts customTools += `createReadReferenceTool(...)`（:236/:239 同缝）。

## §2 定谳（editable-design 移植口径）

### 定谳 5（新 mode 文件）：`studio/workflows/editable-design.md`

- frontmatter：`id: editable-design` + 中文 label/subtitle + step_budget（按源流程
  体量定，缺省参照 longform 50）+ sizes（从 SKILL.md 内容推导海报类预设；推导不出
  就省略走缺省 750x）+ `references`（定谳 1 契约，声明定谳 6 保留的 4 个文件）。
- 正文改写映射（父仓移植提案 §2.2 为蓝本，**以源 SKILL.md 实际内容为权威**）：
  scripts/* → 桥工具（render/describe/look/generate_image/stock_photo/brief 三件套/
  setup_design/set_active_design）；editor.html/layers/replay/Puppeteer 段全删；
  HTML/CSS 约定 → JSX；检查点 → ask_user_question 表单（参照 longform.md「Checkpoint
  表单」节的契约表述风格，但表单内容按 editable-design 自身流程设计——不长照抄
  longform 的 CP1-CP4）；各阶段工具白名单按移植提案 §4.3 形状落到正文。
- **mode 投影连带**：文件存在 = mode 可用 → chips/catalog 自动列出；所有钉死
  「modes == [general, longform]」或 catalog 内容的既有测试须同步（worker grep
  tests/engine/rebuild/studio/ 与 setup 测试定位）。base.md 不动（T46 fidelity 零 diff
  红线）；chips UI 不动。

### 定谳 6（references 迁移）：保留 4 删 3

- 保留并改写（移植提案 §3.1-3.4）：asset-architecture / imagery / layout-typography /
  font-system → `studio/workflows/editable-design/references/`（或定谳 2 备选布局）。
- 删除不迁移：editor-runtime / editor-pitfalls / replay-contract（无桥环境对应物，
  移植提案原文即判删）。

## §3 施工清单（worker）

1. 前置核实：registry.ts 扫描深度（定谳 2）→ 定布局。
2. types.ts：StudioAssetReference + 三类资产 `references?` 字段。
3. validate.ts：references 字段校验（定谳 1）。
4. registry.ts：解析 + 存在性检查 + 内部解析路径持有。
5. active-design-host.ts：assembleTurn 索引注入（定谳 3）+ 每回合 allowed set 持有/复位。
6. read-reference.ts 新工具 + service.ts 装配（定谳 4）。
7. editable-design.md + 4 references（定谳 5/6）。
8. 测试（tests/engine/rebuild/studio/ 为主）：references 解析/校验矩阵（合法 + `..` +
   绝对 + 缺文件 + 空 description）、扫描器不吞 references 钉扎、assembleTurn 索引注入
   有无两态、read_reference 允许/拒绝/遍历拒绝/未命中清单/截断；连带更新的 modes/
   catalog 钉扎。另给 read_reference 配后端单测（参照 ask-user-question 测试形态）。
9. `bunx oxfmt --write` 仅触及文件；写 T85-self-check.md（含扫描深度裁决等偏差记录）。

## §4 边界与门禁

- 受影响测试：tests/engine/rebuild/studio/ 目录 + 新增测试文件 + 受 mode 投影连带的
  测试；其余不跑（owner 禁令）。七门禁主 agent 收口跑。
- 与 T84 并行施工：文件面零交叠（T84 = packages/core/src/text/ + tests/engine/text/），
  双方都不得 git add/commit、不得触碰对方文件。
- zone 预判：studio/ 与 tests/engine/rebuild/ 既有 ownedRoots，预期零新登记。
- i18n：mode label/subtitle 走 frontmatter（同 longform 先例），不动 locale 文件。
