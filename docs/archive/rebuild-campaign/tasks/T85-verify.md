# T85 verify——独立核验报告

> **独立核验**：第三方 reviewer（与施工 agent 隔离）
> **核验日期**：2026-09-02
> **工作区状态**：branch `rebuild/mode-arch`，5 commits ahead of origin；T85 改动**未提交**（git status 可见 12 改 + 8 新建）。说明：git status 报 12 改 / 8 未跟踪文件含**非 T85 文件**——fonts.ts / zones.json / cjk-fallback.test.ts / T84-self-check.md 来自并行任务 T84，**零交叠**（T84 锁定 `packages/core/src/text/` 与 `tests/engine/text/fonts/`，T85 锁定 `src/app/ai/pi-backend/studio/`、`tests/engine/rebuild/{studio,pi-backend}`、`tools/rebuild/src/verify/`）。
> **硬约束遵守**：只读（除本报告）；不 git add/commit；未读 `.openpencil/key-env`；仅跑指定测试。

---

## A. 机制（定谳 1-4）

### A1 · PASS — types.ts 单源 + 三类资产 references? + resolvedReferences 桶 + 绝对路径不入 manifest 投影

**证据**：

- `src/app/ai/pi-backend/studio/types.ts:38-43`：`export interface StudioAssetReference { path; description }` 单源。
- `types.ts:51`（StudioBase）、`types.ts:65`（StudioWorkflow）、`types.ts:82`（StudioProfile）均含 `references?: StudioAssetReference[]`。
- `types.ts:124` `resolvedReferences: ReadonlyMap<string, ReadonlyMap<string, string>>` 内部桶；注释明确「绝对路径不进 manifest 投影（T45 脱敏纪律延伸）」。
- `types.ts:128-130` `referenceBucketKey(kind, id)` 单源导出键面。
- `src/app/ai/pi-backend/studio/manifest.ts:44-63` `toStudioManifest()` 只投影 `mode/profile/failure` 三字段，**不读 `resolvedReferences`**——绝对路径天然不进前端数据面（registry.ts 也在 line 119 注释「manifest 不投影」双重钉扎）。
- `studio/index.ts` 导出追加 `referenceBucketKey` + `StudioAssetReference`（diff `+2`，无同构双写，type-shapes 跑出 `No duplicate object type shapes found.`）。

### A2 · PASS — validate.ts references 校验矩阵 + 病态条目处置粒度正确

**证据**：

- `src/app/ai/pi-backend/studio/validate.ts:100-106` `referencePathProblem` 拒 `..` / 绝对路径（`/` 起首 = UNC 同拒）/ 盘符 / 非 .md，与定谳 1 矩阵一致。
- `validate.ts:113-164` `parseReferences`：反斜杠归一（line 145 `replaceAll('\\', '/')` 后校验）/ 路径非空 / description 非空；任一非法 → issue 逐条记录 + 不产出 references（同 sizes 先例，`issues.length === before` 守卫 line 163）。
- `validate.ts:96` 注释验证 / 读取双侧拒 `..` 纵深防御。
- 自评偏差 3 一致性：缺文件不连坐资产本体（`registry.ts:155` `kept.length > 0` 才返回）；frontmatter 病态 → 整条不注册（`validate.ts` 全段与 sizes 先例对齐）。`references.test.ts:273-297`「缺文件：条目摘出 + failures 显式条目（资产仍注册）」钉扎该口径。
- matrix 全绿：`references.test.ts:191-212` 五个病态用例（`..` / 内嵌 `..` / `/abs/` / `C:\` / 非 .md）+ `references.test.ts:214-230` 四个 description / path 缺失用例全过。

### A3 · PASS — registry.ts listMarkdownFiles 非递归 + 解析路径内部持有

**证据**：

- `src/app/ai/pi-backend/studio/registry.ts:55-65` `listMarkdownFiles`：仅 `readdirSync(dir, withFileTypes).filter(e.isFile() && .md)`，**不递归**——注释 line 17-18 双重钉扎「非递归。
- `registry.ts:127-157` `resolveReferences`：解析基 = `join(dirname(candidate.path), candidate.id, ref.path)`（按资产分目录 `<所在目录>/<id>/`，定谳 2 注释 line 121-123）；存在性 → 进桶；缺失 → `fail(failures, candidate, kind, reason, hint)`，reason 含声明 path + hint 指路补齐/删声明。
- `registry.ts:317` `resolvedReferences: resolved` 内部面返回；`registry.ts:336` 入注册表内部桶——投影面（manifest.ts）不读，**绝对路径不出后端进程**（types 注释 + manifest 不读双钉扎）。
- 真目录钉扎：`builtin-assets.test.ts:56-74` `r.workflows.size === 2`（references/ 子目录 4 个 .md 未误注册）+ `modes.map === ['general', 'editable-design', 'longform']` + `bucket.size === 4` + 4 个桶内路径都含 `workflows/editable-design/references`。
- 备选 `studio/references/<asset-id>/` 布局未启用——主布局落地正确。

### A4 · PASS — active-design-host.ts 索引节空槽/三分支 + 允许集复位 + 同 path 冲突

**证据**：

- `src/app/ai/pi-backend/active-design-host.ts:104` `REFERENCES_INDEX_HEADING` 字面口径。
- `active-design-host.ts:107-128` `collectActiveReferences`：base 恒在 + 命中 workflow + 命中 profile；source 标 `base` / `workflow: <id>` / `profile: <id>`；同 path 冲突 `if (abs && !allowed.has(ref.path))` 先声明先赢（line 121）；空并集 → 空 indexSection。
- `assembleTurn` 四分支（line 164-194）：`empty` / `general` / `workflow 命中` / `workflow 缺失 → base only` 都正确走 `finishTurn`——`empty + 无 references → 只 BASE，无索引节`；`workflow 缺失 + workflow 有 references → references 不进并集`（`active-design-host.test.ts:454-462` 钉扎）。
- `TurnAssembly.allowedReferences`（line 91-101）：声明 path → 解析绝对路径；空 Map 即「本回合不可读任何 reference」。
- 复位：prepareTurn 清零 intentConfirmed（line 442）、finalizeTurn `turn = null`（line 460-461）；`active-design-host.test.ts:481-488`「prepareTurn + finalizeTurn 复位」测试通过。
- 钉扎（新）：`active-design-host.test.ts:381-488` 共 6 describe / 6 test 通过——逐字钉索引节行格式、base-only 空槽 + base 有 references、profile 同机制、workflow 缺失隔离、prepareTurn/finalizeTurn 复位。

### A5 · PASS — read-reference.ts 白名单 / 截断 / U+FFFD 剥离 / readFile 注入

**证据**：

- `src/app/ai/pi-backend/read-reference.ts:53-119` `createReadReferenceTool`：本地工厂同 ask-user-question.ts 形态；参数 `{ path: string }`（line 59-63）。
- 路径归一：`read-reference.ts:67` `requested.replaceAll('\\', '/')`（与 validate 存储形态一致）；`read-reference.ts:71-78` `rejectedPathReason` 拒绝对 / 盘符 / `..` / 空 path——返回 `reference_path_rejected` + `available` 清单（纵深防御，validate 已在声明期拦过；read-side 测试 line 76-97 钉「不查文件」）。
- 命中：`abs = allowed.get(normalized)` → `readFile(abs)` → 返回全文 + details `{path, bytes, truncated}`；`read-reference.ts:81-90` 未命中回 `reference_not_allowed` + 本回合可读 path 清单（message 含清单）；空集（回合外）全拒 `available: []`。
- 50KB 截断：`read-reference.ts:103-113` 字节截断 + `.replace(/+$/, '')` 剥 U+FFFD（自评偏差 8 — 显式转义正则避管道剥除）；尾注 `[已截断：原文约 XKB...]`。
- readFile 注入：`read-reference.ts:54` `const readFile = deps.readFile ?? ((absolutePath) => readFileSync(...))` 测试存根可控。
- 测试：`tests/engine/rebuild/pi-backend/read-reference.test.ts` 9 例（命中 / 反斜杠归一 / 未命中清单 / 回合外空集 / `..`+绝对路径运行期拒+不读文件 / 空 path / 读失败结构化错误 / 50KB 截断 + 恰在上限内不截断）全过。

### A6 · PASS — service.ts customTools 装配同缝 + noTools:'builtin' 未动

**证据**：

- `src/app/ai/pi-backend/service.ts:62` 引入 `createReadReferenceTool`；`service.ts:249-251` `createReadReferenceTool({ allowedPaths: () => host.turnAssembly()?.allowedReferences ?? EMPTY_REFERENCES })` 装在 `customTools` 末尾（同 createAskUserQuestionTool :245 / createImageGenTool :242 之缝）。
- `service.ts:121-122` `EMPTY_REFERENCES` 共享常量（回合外恒空）。
- `service.ts:318` `noTools: 'builtin'` 未改；pi 内建 read 仍禁用，read_reference 是唯一读取缝。
- 命题 require 服务装配形态——`active-design-host.test.ts` 改造已对 `turnAssembly().allowedReferences` 钉扎新字段。

---

## B. 移植（定谳 5-6）

### B7 · PASS — editable-design.md frontmatter 齐全 + 正文改写映射落实

**证据**：

- frontmatter（`studio/workflows/editable-design.md:1-20`）：`id: editable-design` / `label: 海报设计` / `subtitle` / `step_budget: 50` / `sizes` 两档（794x1123 + 1080x1080）/ `references` 四条全部声明。
- 正文改写映射：
  - **scripts/editor.html/replay/Puppeteer 段全删**：grep 关键词无残留（`editor.html` / `replay` / `Puppeteer` 命中 0 行 vs 源 SKILL.md 9 处引用）。
  - **桥工具替换**：阶段 0-4 工具白名单覆盖 render / describe / look / generate_image / stock_photo / read_brief / create_brief / append_brief_conclusion / setup_design / set_active_design / ask_user_question / calc / batch_update / update_node / set_layout 等；与 longform 同口径 base tools 已存在验证（B9 节）。
  - **HTML/CSS → JSX**：「JSX 构建约定」节（line 126-136）+「画布构建约定（render JSX）」references 段落（layout-typography.md）。
  - **Checkpoint 表单契约**：line 161-163 完整复刻 longform 表单契约（kind 三种 + required 缺省 true + imageOptions + 方向类末位「都不合适」+「表单内不提供 mode 切换入口」）。`{formId, status:'awaiting_user', questions}` 信封形态（line 163）+ `[表单作答 formId=…]` + freeText（line 163 verbatim）+ 「run 终止续跑」语义——均与 T83 后契约一致。
  - 各阶段白名单按移植提案 §4.3 形状落到正文（line 58/73/83/91/101）。
  - 「你是设计师不是顾问」纪律保留（line 34）；CP1/CP2 条件触发不长照抄 longform CP1-CP4。
- **关键偏差 4 已落实**：imagery.md line 79-86 改写为「本环境 generate_image 无独立 background 参数——在 prompt 里要求真正透明的背景（永不要棋盘格描述）……落位前用 look 确认：空角是真透明、alpha 边缘干净」，**未沿用源提案的虚构 `background:'transparent'` 参数**——B9 进一步佐证该参数在本仓 generate_image schema 不存在。
- **关键偏差 6 已落实**：line 134 `<Icon name="lucide:…">` 内联矢量图标指向既有 base 原语，零能力损失。

### B8 · PASS — references 4 文件按现仓实况改写 + 3 文件未迁移

**证据**：

- 保留 4 → `studio/workflows/editable-design/references/`：
  - `asset-architecture.md`（41 行）：按现仓 append_brief_conclusion 口径改写（asset-plan.json → 一行一条）+ brief 五型拓扑对齐。
  - `imagery.md`（107 行）：脚本导入 → generate_image references/replace_id（line 79、99）+ 尺寸参数 width/height（line 69-72）+ 「generate_image 无独立 background 参数」按实改写（line 79-86，对应偏差 4 纠偏）。
  - `layout-typography.md`（84 行）：HTML/CSS → JSX 与画布语义（line 74-82 标题明示）。
  - `font-system.md`（52 行）：Fontsource kit → core 字体注册表 9 族角色表（line 22-30 表格，按 core fonts registry 命名口径）。
- 3 个删除未迁移（plan §2-6：editor-runtime / editor-pitfalls / replay-contract）：`find studio/workflows/editable-design/references/` 仅 4 个 .md，零误迁。
- 大小：4 文件 41 / 107 / 84 / 52 共 284 行；与源参考规模合理缩量（无桥环境对应物大量不迁）。

### B9 · PASS — 无虚构工具名（grep 全反引号 + 全工具提及逐项验证）

**证据**：

- 反引号 token 提取（`/[^`]+/g`）共 12 个去重后：`auto` / `off` / `reproduce` / `sizes` / `backdrop` / `cutout` / `fragment` / `generated` / `slot` / `user` / `height` / `width`——**全部为 frontmatter 字段值、参数键、状态枚举**，非工具名；零虚构。
- 主要工具名逐项验证：
  - `read_brief` → `core/tools/fork/marketing/tools.ts:44`
  - `create_brief` → `core/tools/fork/marketing/tools.ts:100`
  - `append_brief_conclusion` → `core/tools/fork/marketing/tools.ts:138`
  - `setup_design` → `core/tools/fork/marketing/setup-tool.ts:27`
  - `set_active_design` → `core/tools/fork/marketing/active-design.ts:266`
  - `look` → `core/tools/fork/marketing/look.ts:269`
  - `ask_user_question` → `app/ai/pi-backend/ask-user-question.ts:79`
  - `read_reference` → `app/ai/pi-backend/read-reference.ts:56`
  - `generate_image` → `app/ai/pi-backend/image-gen/generate.ts:305`
  - `render` → `core/tools/create/render.ts:4`
  - `describe` → `core/tools/describe/index.ts:6`
  - `calc` → `core/tools/calc.ts:22`
  - `stock_photo` → `core/tools/stock-photo.ts:19`
  - `set_effects` → `core/tools/modify/effects.ts:8`
  - `set_layout` / `set_layout_child` → `core/tools/modify/layout.ts:6, :117`
  - `set_radius` → `core/tools/modify/geometry.ts:36`
  - `set_fill` / `set_stroke` → `core/tools/modify/paint.ts:9, :63`
  - `set_text` / `set_font` / `set_font_range` / `set_text_resize` / `set_text_properties` → `core/tools/modify/text.ts:9, :25, :50, :85, :106`
  - `set_text_properties`、`update_node` → `core/tools/modify/update.ts:7`
  - `get_node` / `find_nodes` → `core/tools/read/nodes.ts:80, :98`
  - `get_jsx` → `core/tools/read/jsx.ts:9`
  - `delete_node` / `node_resize` → `core/tools/structure/basic.ts:4, :81`
  - `batch_update` → `core/tools/structure/batch.ts:93`
  - `reparent_node` → `core/tools/structure/hierarchy.ts:4`
- 15 个引用工具全部存在（无虚构）；`set_text_properties` 「修正」自评偏差 1 未在阶段工具行（仅「文字溢出/截断」举例），仍存在注册表。

---

## C. 连带与门禁

### C10 · PASS — mode 投影连带：builtin-assets.test.ts 已同步为含 editable-design；余皆 tmp fixture 无需变更

**证据**：

- `tests/engine/rebuild/studio/builtin-assets.test.ts:27` 测试名更新为「双 workflow 注册（longform 画布尺寸节非空；editable-design references 全解析）」；`:56-74` 新增 editable-design 全套钉扎；`:89-91` `expect(r.modes.map((m) => m.id)).toEqual(['general', 'editable-design', 'longform'])`。
- `tests/engine/rebuild/studio/manifest.test.ts:136` 仍 pin `['general', 'longform']` —— **正确无需改**：fixture 用 `mkdtempSync` 自构 builtinDir（line 23）只 put `base.md + longform.md + watercolor_poster_v3.md + old_poster.md`，**与真 builtin 目录完全隔离**；不依赖 studio 注册表全量。
- `tests/engine/rebuild/studio/registry.test.ts:128` 仍 pin `['general', 'longform']` —— **同上理由正确**：C1 用自构 fixture（`mkdtempSync` builtinDir line 25）。
- `tests/engine/rebuild/marketing/setup.test.ts:56-71` `CATALOG` 用独立 fixture 对象 — 与真注册表 modes 解耦，无需变更。
- 其余 grep `tests/` 未发现其他硬编码 `modes ==` 或 `catalog` 内容钉扎需改动。
- 自评结论（§1-定谳 5）正确。

### C11 · PASS — t45-manifest-dump.mjs 递归修复正确 + verify-t45-manifest-dump.json 再生真值

**证据**：

- `tools/rebuild/src/verify/t45-manifest-dump.mjs:9-27`：`readdirSync + copyFileSync` 平铺复制 → `cpSync(srcDir, dstDir, { recursive: true })` 递归复制（自评偏差 7）；注释行 line 21-22 钉 T85 缘由。`tools/rebuild/verify-t45-manifest-dump.json` 由该脚本端到端再生为当前真值（modes 含 editable-design），自评偏差 9 端到端实证。
- 产物 `verify-t45-manifest-dump.json:1-39`：modes 三条（general / editable-design / longform）+ profiles 四条 + failures 仅 `base.md 缺失` 一条（脚本历史不复制 base.md，符合 T45 先于 T46 的设计口径，非本任务引入）。
- 平铺脚本面是 `tools/rebuild/src/verify/` 唯一一处平铺复制 studio 子目录形态；grep 确认（同文件结构）。
- 注：tools/rebuild/src/verify/t45-manifest-dump.mjs 注释 line 36 指明「覆盖文件须过 `bunx oxfmt --write` 再过 format:check」——现 json 已格式化（自评 §2-9）。

### C12 · PASS — base.md 零 diff（T46 红线遵守）+ i18n locale 零 diff

**证据**：

- `git status -s src/app/ai/pi-backend/studio/base.md`：**空**（零修改）。
- `git diff --stat`：12 modified 全部已在 A1-A6 列出 + T84 范围，**零触及 base.md**。
- `find src -type f -name "*locale*"` 唯一命中 `src/app/i18n/notifications/locales/zh-cn.json`；`git status -s src/app/i18n/`：**空**。

### C13 · PASS — 实测复跑 117+ pass / 0 fail

**证据**：

```
$ bun test tests/engine/rebuild/studio/ tests/engine/rebuild/pi-backend/ tests/engine/rebuild/marketing/setup.test.ts
 117 pass
 0 fail
 465 expect() calls
Ran 117 tests across 10 files. [2.86s]
```

新增测试细分：
- `studio/references.test.ts`：10 例（合法注册 + base/profile 同机制 + 反斜杠归一 + 病态矩阵 3 例 + 缺文件 + 扫描器钉扎 + 用户覆盖）。
- `pi-backend/read-reference.test.ts`：9 例（命中 / 反斜杠归一 / 允许拒绝 5 例 / 50KB 截断 2 例）。
- `pi-backend/active-design-host.test.ts` 新增 6 例（references 索引注入）+ 既有 11 例（assembleTurn + 新建意图 + 表单作答）+ 桥假件管线（无新增删）。
- `studio/builtin-assets.test.ts` 1 例增强（增 editable-design 钉扎块）。

类型与门禁：
```
$ bunx tsgo --noEmit  →  零输出（零错误）
$ bun run test:type-shapes  →  No duplicate object type shapes found.
```

---

## 自评偏差（§2 九条逐条复核）

| 序 | 偏差 | 复核结论 |
|---|---|---|
| 1 | 扫描深度裁决（listMarkdownFiles 非递归） | PASS — `registry.ts:55-65` 实现确为非递归；真目录 + fixture 双重钉扎。 |
| 2 | 解析基解释性裁决（`<资产文件所在目录>/<资产 id>/`） | PASS — `types.ts:36-39` + `registry.ts:121-123, :137` 注释已成文。 |
| 3 | 缺文件不连坐资产本体 | PASS — `registry.ts:155` `kept.length > 0` 才返回；`references.test.ts:273-297` 钉扎。 |
| 4 | 透明资产参数纠偏（虚构 `background:'transparent'`） | PASS — `imagery.md:79-86` 按实改写，B9 验证 generate_image schema 无 background 参数。 |
| 5 | sizes 推导（794x1123 + 1080x1080） | PASS — `editable-design.md:7-10` frontmatter 落地；与源「定画布」语义对应（区别 longform HUG）；A4 印 sorting = `editable-design < longform`。 |
| 6 | Lucide 段非删转接（`<Icon name="lucide:…">`） | PASS — `editable-design.md:134` 改写指向既有 base 原语。 |
| 7 | t45 dump 递归修复 | PASS — `t45-manifest-dump.mjs:9-27` cpSync(recursive)。 |
| 8 | 格式器零冲突（U+FFFD 显式转义正则） | PASS — `read-reference.ts:111` `.replace(/+$/, '')` + 测试钉扎。 |
| 9 | verify-t45-manifest-dump.json 再生 | PASS — `verify-t45-manifest-dump.json:1-39` 反映 modes 含 editable-design。 |

---

## 总结论

**13/13 PASS · 零 FAIL · 零警告 · 零门禁红**

T85 验收映射 6 条定谳全部落地：
- 机制层（定谳 1-4）白名单/按需读取/空槽三分支/允许集复位全齐；
- 移植层（定谳 5-6）脚本 editor.html replay Puppeteer 全删 / 桥工具替换落实 / 4 references 按实改写 + 3 不迁；
- 连带与门禁（base.md / i18n / mode 投影）零红线 / 117 测试全绿 / type-shapes 单源守卫绿。

## 问题清单（零）

无 FAIL；零修复建议。

---

## 附：未变更但需提示的项

- `packages/core/src/text/fonts.ts` / `tools/zone-registry/zones.json` / `tests/engine/text/fonts/cjk-fallback.test.ts` / `docs/rebuild/tasks/T84-self-check.md` 在 `git status` 可见，但属并行 T84 任务（zones.json 测试登记段新增 `cjk-fallback.test.ts`，与 T85 文件面零交叠）。T85 reviewer 不审 T84，T84 由其专项 review 处理。
- `verify-t45-manifest-dump.json` 含 `base.md` 缺失 failure 条目，是该 verify 脚本历史口径（不复制 base.md），非 T85 引入——已被自评偏差 9 识别。

