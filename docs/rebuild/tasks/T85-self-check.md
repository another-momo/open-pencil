# T85 self-check——资产 references 按需读取机制 + editable-design mode 移植

## §1 plan 定谳逐项自评

### 定谳 1（frontmatter 契约）——PASS
- ✅ `StudioAssetReference {path, description}` 单源落 `studio/types.ts`；三类资产
  （base/workflow/profile）统一可选 `references?` 字段；测试 fixture 一律 import 此型
  （references.test.ts / active-design-host.test.ts 均 import，test:type-shapes 绿：
  `No duplicate object type shapes found.`）。
- ✅ validate.ts `parseReferences`（三类共用，sizes 先例全有或全无）：path 非空 +
  相对 + 无 `..` + 无绝对/盘符/UNC + .md 结尾；description 非空；反斜杠归一为正斜杠
  存储。病态 → issues 逐条记录 → 资产整条不注册 + failures 带指引。
- ✅ 文件存在性在 registry 加载期检查（validate 纯函数不碰 fs）；缺失 → failures
  显式条目（reason 含声明 path + hint 指路补齐或删声明，path 为相对 origin 相对
  路径口径）。
- ✅ registry 内部持有解析绝对路径：`StudioRegistry.resolvedReferences`
  （桶键 `${kind}:${id}`，键面单源 `referenceBucketKey()`）；manifest.ts 未改——
  本字段天然不进投影（T45 脱敏延伸钉扎由既有 manifest 泄漏检查覆盖：
  绝对路径不出 failures.path，references 字段整体不投影）。

### 定谳 2（目录约定）——PASS（主布局落地，含裁决）
- 前置核实结论：`listMarkdownFiles`（registry.ts）**非递归**——
  `readdirSync(withFileTypes).filter(e.isFile() && .md)` 只取直视子文件，子目录
  不触。→ 采用主布局 `studio/workflows/editable-design/references/`，备选布局
  （`studio/references/<asset-id>/`）不启用。
- ✅ 扫描器不吞 references 双钉扎：fixture 测试（references.test.ts「扫描器钉扎」）
  + 真目录钉扎（builtin-assets.test.ts：`workflows.size === 2`——4 个 reference
  .md 在列未误注册）。
- 解析基裁决见 §2-2。

### 定谳 3（索引注入）——PASS
- ✅ assembleTurn（active-design-host.ts）：本回合 active 资产（base 恒在 + 命中
  workflow + 命中 profile）references 并集非空时，joinSegments 尾段追加
  `## 按需参考（read_reference 工具按需读取）` 节，行格式
  `- <path> —— <description>（<source>）`（source = `base` / `workflow: <id>` /
  `profile: <id>`）——测试逐字钉扎。
- ✅ 空槽 = base only（base 有 references 才出现该节，有测试）；落盘 mode 的
  workflow 缺失 → workflow references 不进并集（mode 作用域隔离，有测试）；
  profile 未选中/未命中不进并集（有测试）。
- ✅ 尾段追加 + active 集合同 mode 稳定 → prefix 缓存友好。

### 定谳 4（read_reference 工具）——PASS
- ✅ 新文件 `src/app/ai/pi-backend/read-reference.ts`：`createReadReferenceTool(deps)`
  工厂返回 pi AgentTool（ask-user-question.ts 同款形态：本地执行、不过桥、无凭证、
  无落盘）。
- ✅ 参数 `{path}`；允许集 = 本回合 active 资产声明并集（assembleTurn 计算进
  `TurnAssembly.allowedReferences`，宿主持有于 turn 缓存袋，finalizeTurn 随
  turn=null 复位——prepareTurn/finalizeTurn 复位有测试）。
- ✅ 命中读全文；50KB（51200 字节）上限按字节截断 + 尾部注明（边界多字节字符
  剥 U+FFFD 替代符）；未命中/未声明 → `reference_not_allowed` + 本回合可读清单；
  空允许集（回合外）全拒；`..`/绝对路径/盘符运行期再拒（`reference_path_rejected`，
  不查文件——validate 声明期已拒，纵深防御双侧重锤）。
- ✅ `noTools: 'builtin'` 未动——pi 内建 read 保持禁用，read_reference 是唯一读取缝。
- ✅ service.ts customTools 装配（createAskUserQuestionTool 同缝，:239 后追加）；
  回合外允许集恒空（共享 `EMPTY_REFERENCES` 常量）。

### 定谳 5（新 mode 文件）——PASS
- ✅ `studio/workflows/editable-design.md`：frontmatter = `id: editable-design` +
  label「海报设计」+ subtitle + `step_budget: 50` + sizes 两档（推导见 §2-5）+
  references 四条声明。
- ✅ 正文改写映射落实（以源 SKILL.md 605 行通读内容为权威）：scripts/* → 桥工具
  （render/describe/look/generate_image/stock_photo/read_brief/create_brief/
  append_brief_conclusion/setup_design/set_active_design）；editor.html/layers/
  replay/Puppeteer 段全删；HTML/CSS 约定 → JSX（「JSX 构建约定」节 + base props
  口径衔接）；检查点按 editable-design 自身流程设计 = CP1 同题冲突确认 + CP2 缺
  事实追问（均条件触发，不长照抄 longform CP1-CP4——源 skill「你是设计师不是
  顾问」纪律不设方向选择闸）；各阶段工具白名单按移植提案 §4.3 形状落正文；
  沟通纪律/参考模式四值/资产架构五型/审阅清单/resume 协议保留改写。
- ✅ mode 投影连带：builtin-assets.test.ts 更新为 modes == [general, editable-design,
  longform]；grep 全 tests/ 确认其余 modes/catalog 钉扎均走 tmp fixture
  （registry/manifest/active-design-host 测试）或独立 catalog fixture
  （marketing/setup.test.ts）——零其他连带。base.md 未动（T46 fidelity 零 diff
  红线）；chips UI 未动；locale 未动。

### 定谳 6（references 迁移）——PASS
- ✅ 保留改写 4 个 → `studio/workflows/editable-design/references/`：
  asset-architecture.md（asset-plan.json → brief 结论区一行一条口径）/
  imagery.md（脚本导入 → generate_image references/replace_id；尺寸 → width/height
  参数）/ layout-typography.md（HTML/CSS → JSX 与画布语义）/ font-system.md
  （Fontsource kit → core 字体注册表 9 族角色表与配对）。
- ✅ 删除 3 个未迁移：editor-runtime / editor-pitfalls / replay-contract（无桥环境
  对应物；replay 语义由 brief 结论区承载，正文已指向）。

## §2 偏差记录

1. **扫描深度裁决**：listMarkdownFiles 非递归 → 主布局落地，无备选布局偏差。
2. **解析基解释性裁决**：定谳 1 注释「相对资产文件所在目录」与定谳 2「按资产分
   目录」字面张力（`references/imagery.md` 相对 `workflows/` 解析不到
   `workflows/editable-design/references/`）。裁决：解析基具体化为
   `<资产文件所在目录>/<资产 id>/`（workflow → `workflows/<id>/`、profile →
   `profiles/<id>/`、base → `studio/base/`）——定谳 1 示例与定谳 2 布局同时成立，
   三类统一。types.ts/registry.ts 注释已成文。
3. **缺文件注册粒度**：plan 只言「缺失进 failures[]」未定粒度。裁决：缺失条目
   摘出注册资产（资产本体仍注册，索引/允许集天然不含该条）；frontmatter 病态才
   整条不注册（validate 段，sizes 先例）。理由：缺 .md 是文件系统状态而非资产
    authoring 病，连坐会让 mode 整个消失，违背 S2 §8「单文件失败不影响其余」精神。
4. **透明资产参数纠偏**：移植提案 §3.2 写「用 `background: 'transparent'` 参数」
   ——本仓 generate_image schema 无该参数（仅 prompt/width/height/replace_id/
   references）。imagery.md 按实改写：prompt 声明真透明背景（不要棋盘格）+ look
   验收 alpha 边缘 + 失败止损换路线，不虚构参数。
5. **sizes 推导**：源 SKILL.md 无具体像素预设，仅有打印段（96px/英寸换算）。推导
   两档定高预设：竖版海报 794x1123（A4 印刷比 ≈ 8.27in×11.69in×96）+ 方形社交
   卡片 1080x1080；定高贴合源「fixed-canvas」语义（区别于 longform 的 HUG）。
6. **Lucide 段非删转接**：源「Codex bundled Lucide」段——本环境 render JSX 已有
   `<Icon name="lucide:…">` 原语（base.md 已定），改写指向既有 Icon，零能力损失。
7. **tools/ 连带修复（施工面外，必然连带）**：t45-manifest-dump.mjs 原以
   `readdirSync + copyFileSync` 平铺复制 workflows/——新 references 子目录会让
   copyFileSync 打目录抛 EISDIR。改 `cpSync(recursive)` 整目录复制（references
   随资产进 temp 布局，manifest 核验语义不变）。已 grep 确认 tools/rebuild 其余
   verify 脚本无同类平铺复制 studio 目录的形态。
8. **格式器零冲突**：触及文件已过 `bunx oxfmt --write`；read-reference.ts 的
   U+FFFD 剥离正则写作显式转义 `/\uFFFD+$/`（字面 `` 会被写作管道剥除，
   曾造成 `/+$/` 语法错误——已修并钉测试）。
9. **t45 dump 产物再生（误触的核验顺带）**：语法核验时误以 import 执行了
   t45-manifest-dump.mjs（顶层副作用）——脚本完整跑通（status 200、泄漏检查
   CLEAN、modes 含 editable-design），等于 §2-7 修复获端到端实证；产物
   verify-t45-manifest-dump.json 被覆写为当前真值（含 editable-design），
   已按脚本头注纪律 `bunx oxfmt --write` 该 json。base.md 缺失 failure 条目
   为该脚本历史口径（它从不复制 base.md，T45 先于 T46），非本任务引入。

## §3 测试输出摘要

受影响测试全绿（oxfmt 后复跑）：

```
bun test tests/engine/rebuild/studio/ tests/engine/rebuild/marketing/setup.test.ts tests/engine/rebuild/pi-backend/
 117 pass
 0 fail
 465 expect() calls
Ran 117 tests across 10 files. [3.05s]
```

其中新增：studio/references.test.ts 10 例（校验矩阵 + 存在性 + 归一 + 扫描器
钉扎 + 分层覆盖）、pi-backend/read-reference.test.ts 9 例（允许/未命中清单/遍历
拒绝/空集/读失败/截断两态/反斜杠归一）、active-design-host.test.ts 新增
「references 索引注入」describe 6 例（尾段行格式逐字/无引用两态/base-only/
profile 并集/workflow 缺失隔离/prepareTurn+finalizeTurn 复位）。

连带确认（引用了 studio 模块但不在主跑单的两个测试）：

```
bun test tests/engine/rebuild/marketing/golden-watercolor-v2.test.ts tests/engine/rebuild/image-gen/prompt-discipline.test.ts
 9 pass / 0 fail（读特定 profile 文件与 base.md，与本任务面零交叠）
```

类型与形状门禁：

```
bunx tsgo --noEmit  → 零输出（零错误）
bun run test:type-shapes → No duplicate object type shapes found.
```

## §4 文件变更清单（真实改动）

**新建（8）**：
- `src/app/ai/pi-backend/read-reference.ts`
- `src/app/ai/pi-backend/studio/workflows/editable-design.md`
- `src/app/ai/pi-backend/studio/workflows/editable-design/references/asset-architecture.md`
- `src/app/ai/pi-backend/studio/workflows/editable-design/references/imagery.md`
- `src/app/ai/pi-backend/studio/workflows/editable-design/references/layout-typography.md`
- `src/app/ai/pi-backend/studio/workflows/editable-design/references/font-system.md`
- `tests/engine/rebuild/studio/references.test.ts`
- `tests/engine/rebuild/pi-backend/read-reference.test.ts`

**修改（9）**：
- `src/app/ai/pi-backend/studio/types.ts`（StudioAssetReference + 三类 references? + resolvedReferences + referenceBucketKey）
- `src/app/ai/pi-backend/studio/validate.ts`（parseReferences + 接入 workflow/profile 校验）
- `src/app/ai/pi-backend/studio/registry.ts`（resolveReferences 存在性检查与解析 + 三个 load 函数接线 + 扫描深度钉针头注）
- `src/app/ai/pi-backend/studio/index.ts`（出口 +2）
- `src/app/ai/pi-backend/active-design-host.ts`（TurnAssembly.allowedReferences + assembleTurn 索引注入/允许集）
- `src/app/ai/pi-backend/service.ts`（customTools 装配 read_reference + EMPTY_REFERENCES）
- `tests/engine/rebuild/pi-backend/active-design-host.test.ts`（fixture 补 resolvedReferences + 1 处 toEqual 同步 + 新 describe 6 例）
- `tests/engine/rebuild/studio/builtin-assets.test.ts`（modes 三连钉扎 + editable-design 注册/references/扫描器真目录钉扎）
- `tools/rebuild/src/verify/t45-manifest-dump.mjs`（平铺复制 → cpSync 递归，§2-7）
- `tools/rebuild/verify-t45-manifest-dump.json`（核验脚本再生真值 + oxfmt，§2-9）

合计：新建 8 + 修改 10 = 18 个文件。
