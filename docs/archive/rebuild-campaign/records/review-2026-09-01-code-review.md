<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 整体代码 review · 2026-09-02

## 0. 元信息

- **范围**: rebuild/mode-arch @ HEAD (`cd153dbf8ffd570926a98321893a2944ba3ddd14`，2026-09-01 22:52:47 +0800，「T70 画布选区采集——内联 token + 消息尾清单」)
- **评审方式**: 只读，grep/Read/wc 三件取证
- **报告路径**: `docs/rebuild/records/review-2026-09-01-code-review.md`
- **兄弟报告**: `docs/rebuild/records/review-2026-09-01-research-adjudication.md`（已落地；本报告专注代码面，不重复其内容）
- **未触碰目录**: `node_modules/`、`.git/`、`.openpencil/`、`dist/`、`build/`、`.worktrees/`、`tests/fixtures/` 二进制 fixture、`packages/*/dist/`（已用 `grep --exclude-dir=node_modules --exclude-dir=dist` 过滤）
- **取证日期**: 2026-09-02

---

## 1. 摘要表

| 严重度 | 数量 | 标题 |
|---|---|---|
| P0 必须修 | 0 | — |
| P1 必须修 | 2 | T72 第 4 处遗漏面（CLI eval 通过桥名调用但未过滤校验）；T69 v3 仍含 `derive_palette` 4 处 |
| P2 建议修 | 3 | T66 abort 不打断进行中长 HTTP；T71 routes.ts 405/400 错误文案非 JSON `error` 字段化；T66 verify claim #10 文案与 grep 字面结果冲突 |
| P3 暂缓 | 2 | P21/P38/P40 物理文件仍存在（revoked = 不再 patch，非删除）；T62 type-blueprint 注释残留（仅 comment，无运行时影响） |

**总判定**: T66/T67/T68/T69/T70/T71/T72 七任务代码面**全部落地与三件套一致**，无 P0 阻断；T72 一处 P1 漏面（T72-verify §V6 实证 CLI 零消费，但缺一处**反向钉扎**——本面仅靠 grep 实证，未防 CLI 未来接入 ALL_TOOLS 时回归）；T69 v3 profile 已知未做（T69-plan §3 显式列入不做清单——记录升级为 P1 是为了 owner 知会，不属代码 bug）。

---

## 2. P0 / P1 详单

### P1-01 · T72 第 4 处遗漏面风险：CLI `toolsToAI` 透出可能

- **面编号**: 面 1（跨任务一致性）/ 面 2（测试盲点）
- **证据**:
  - `grep -rn "ALL_TOOLS\|FORK_TOOLS\|createOpenPencilTools\|createToolDescriptors\|toolsToAI" packages/cli/src/ --include="*.ts"` rc=0 → **零命中**（2026-09-02）
  - 反面验证：`grep -rn "ALL_TOOLS\|FORK_TOOLS\|toolsToAI" packages/ --include="*.ts" | grep -v "node_modules\|dist/"` 实证 = 仅 `core/src/tools/ai-adapter.ts:50` (`toolsToAI` 定义) + `core/src/tools/registry.ts:12` (`ALL_TOOLS` 拼装) + `core/src/index.ts:76/80`（重导出） + `pi-backend/tools.ts:260`（filter 已挂）+ `mcp/src/tool/{manifest,registration}.ts:47/82`（filter 已挂）——**CLI 消费面不存在**（2026-09-02）
  - 现有钉扎：`tests/engine/rebuild/image-gen/internal-visibility.test.ts:36-38` 钉扎 ALL_TOOLS 全仓 internal 清单精确等于两件（防静默新增）——但**未钉扎 CLI/其他未来新增消费面**
- **影响**: 当前零面（CLI 未消费），但 T72-verify §V6 仅靠"grep 实证零消费"做结论——若未来 CLI 加入 `toolsToAI(ALL_TOOLS)` / 类似消费面时，未有反向钉扎会**漏过滤导致 internal 工具外泄**
- **建议修法**（不实施，只描述）：
  1. 在 `tests/engine/rebuild/image-gen/internal-visibility.test.ts` 新增一组钉扎：遍历 `packages/cli/src/**` 的 import 语句，若发现任何 `ALL_TOOLS` / `FORK_TOOLS` / `toolsToAI` 引用则 fail（白名单形式——明示 CLI 不得消费这两个面）
  2. 或：在 `tools/architecture/` 加一条规则——禁止 `packages/cli/src/**` 引用 `core/tools/registry` 与 `core/tools/ai-adapter`

### P1-02 · T69 v3 profile 仍含 `derive_palette` 4 处（owner 知会项，非代码 bug）

- **面编号**: 面 1（跨任务一致性）
- **证据**:
  - `grep -n "derive_palette\|sample_hero_color" src/app/ai/pi-backend/studio/profiles/watercolor_poster_v3.md` 命中 4 处（line 18 / 26 / 38 / 48）（2026-09-02）
  - T69-plan §3 「明确不做」显式列入 `watercolor_poster_v3`（derive_palette 悬空，随其改写轮——拓展批），**任务书允许**（T69-self-check §5 在案）
  - 任务书口径 `grep derive_palette/sample_hero_color 在 prompts/ 与 studio/ 零残留（v3 profile 除外）`（T67-plan §1 验证标准）——与实测一致
- **影响**: 代码面无运行时 bug（v3 非本批 mode 首选；用户/agent 选 v3 时会用到死链工具 `derive_palette` → 工具注册面无此工具 → 编排器报"tool not found"），但属**已知待办**
- **建议修法**（不实施，只描述）：
  - 立 T73「v3 profile 改写」专项，吸收 derive_palette 退出后的 4 处 + sample_hero_color 同型残留（若存在）
  - 或：v3 改为「不导出」——frontmatter 加 `enabled: false` 或从 `studio/profiles/` 移除（v3 当前非本批首选，但 profile 仍在仓内被 validator 扫到，可能影响 studio 三套件测试）

---

## 3. P2 / P3 详单

### P2-01 · T66 abort 不打断进行中长 HTTP

- **面编号**: 面 1
- **证据**: `service.ts:464-466` 注释「abort 只置信号、等当前工具收尾」+ T66-self-check §3.4 双向在案 + T66-verify §2.4 observation（2026-09-02）
- **影响**: 用户按停止后最长 240s（generate HTTP 超时）才真停；属记录在案限制，非回归
- **建议修法**: 工具层 signal 透传（generate.ts execute 接 pi abort signal），归后续可选方向（不在本批）

### P2-02 · T71 routes.ts 4xx 文案非标准 `error` 字段

- **面编号**: 面 1
- **证据**: `grep -n "sendJSON" src/app/ai/pi-backend/image-gen/routes.ts` 实证：:25 helper / :45 200 / :50 200 / :54 405 / :64 400 / :70 200 / :74 400 / :83 200 / :97 400 catch（2026-09-02）。所有 4xx 均走 sendJSON，结构 `{error: '...'}` 合规——**但 405/400 文案为英文（'Method Not Allowed' / 'apiKey required' / 'providerType, baseUrl, model and apiKey required'）**，与 fork i18n 面脱节（zh-cn 用户看到英文错误提示）
- **影响**: 用户体验一致性（fork zone 强制 i18n，但后端错误文案直硬编英文）
- **建议修法**: 错误码抽常量 + i18n key 化（`error.apiKeyRequired` 等），或前端 catch 后用 `dialogs.value.*` 转译

### P2-03 · T66 verify claim #10 与实际 grep 边界

- **面编号**: 面 1（验证文档）
- **证据**: T66-verify §10：「`grep "image-gen\|history" ChatBriefDialog.vue active-design.ts` rc=1」实测零命中（2026-09-02 实证，rc=1）。但 `ChatBriefDialog.vue:46` 与 `active-design.ts:24/32/38/39/40/44` **确实**有 `@open-pencil/core/tools/fork/marketing/{brief-edit,setup}` 等 marketing 导入——只是不含 `image-gen` 或 `history` 字面，故 grep 字面为零。claim 字面正确，**但易误读**（"零交叉"语义边界含糊）
- **影响**: 文档可读性
- **建议修法**: T66-verify §10 改写为「A↔B 字面零交叉（image-gen/history 关键字 grep rc=1；marketing 导入仅是 A 自身职责，**非 B 跨界**）」

### P3-01 · revoked P21/P38/P40 物理文件仍存在

- **面编号**: 面 3
- **证据**: `ls -la .lfsconfig packages/vue/src/i18n/messages/dialogs.ts packages/vue/src/i18n/locales/zh-cn/dialogs.json` 实证三文件均存（2026-09-02）。zones.json:21/38/40 disposition=revoked
- **影响**: 与 zones.json 语义一致（revoked = 不再 patch 但文件保留，合并面降冲突）；无功能影响
- **建议修法**: 不删——属设计取舍（T36/T38/T40 评估注记在 zones.json comments）

### P3-02 · T62 type-blueprint 注释残留

- **面编号**: 面 2（死代码）
- **证据**: `grep -rn "type_blueprint\|typeBlueprint\|TypeBlueprints" packages/ src/ --include="*.ts"` rc=1（2026-09-02）。零运行时引用
- **影响**: 零（仅 i18n comment + manifest.ts:17/studio/types.ts:53 含「gallery 展示用」语义注记——这些注记非蓝图机制残留，属元信息描述）
- **建议修法**: 不动；如未来"gallery 展示"语义不再成立，注释可一并清理

---

## 4. zones.json 登记 vs 实证消费对照

> 总计 93 个 P-NN 条目（核验命令：`python -c "import json; print(len(json.load(open('tools/zone-registry/zones.json'))['patches']))"` 输出 93，2026-09-02）。
> 抽样审计 P130-P140（最近批次，T52-T59-T64-T72）+ P44/P51/P52/P53/P54/P55/P56（owner 拍板相关），其他条目沿用历史核验结论。
> 完整 P-NN 列表见 §4.1 末尾。

| P-NN | 登记符号 | 实证 grep 命中（≥1 处） | 结论 |
|---|---|---|---|
| P21 | `.lfsconfig` | 物理文件存（40B，`ls -la`）；revoked 不再 patch | ✓ |
| P38 | `packages/vue/src/i18n/messages/dialogs.ts` | 物理文件存（19532B）；revoked 不再 patch | ✓ |
| P40 | `packages/vue/src/i18n/locales/zh-cn/dialogs.json` | 物理文件存（19638B）；revoked 不再 patch | ✓ |
| P44 | `src/components/settings/SettingsDialog.vue` | grep 命中 SettingsDialog 引用 ≥1 处；ownedFiles 已登记 | ✓ |
| P51-P56 | core T27 系列 6 文件 | 全部位于 packages/core/src/{constants,editor/clipboard} 或 tools/{secret-scan,architecture}/src；git log 实证 T27 改动在案 | ✓ |
| P130 | `packages/core/src/bytes/index.ts` | grep 实证被 bytes/image-mime.ts 等 4 处 import | ✓ |
| P131 | `packages/core/src/figma-api/index.ts` | grep 实证被广泛引用（核心） | ✓ |
| P132 | `packages/core/src/io/formats/raster/render.ts` | grep 实证被 io/formats/* 引用 | ✓ |
| P133 | `packages/core/src/io/formats/svg/defs.ts` | grep 实证被 io/formats/svg/* 引用 | ✓ |
| P134 | `packages/core/src/tools/index.ts` | grep 实证 = registry.ts + fork/index.ts；T52 落点 | ✓ |
| P135 | `src/app/automation/bridge/figma-factory.ts` | grep 实证被 bridge/handlers.ts 引用；T55 落点 | ✓ |
| P136 | `src/app/automation/bridge/handlers.ts` | grep 实证被 automation/bridge/* 多处引用；T59 落点 | ✓ |
| P137 | `src/app/document/export/files.ts` | grep 实证被 export/* 引用；T55 落点 | ✓ |
| **P138** | `packages/core/src/tools/schema.ts` | grep 实证 `#core/tools/schema` 被 `fork/image-gen/tools.ts:14` import | ✓（T72） |
| **P139** | `packages/mcp/src/tool/registration.ts` | grep 实证 `#mcp/tool/registration` 被 `mcp/src/server.ts:20,61` + `mcp/src/tool/manifest.ts:12` import | ✓（T72） |
| **P140** | `packages/mcp/src/tool/manifest.ts` | grep 实证 `#mcp/tool/manifest` 被 `mcp/src/server.ts:17` + `mcp/src/tool/registration.ts:12` import | ✓（T72） |

**ownedRoots 覆盖核查**（核验命令：`python -c "import json; print(json.load(open('tools/zone-registry/zones.json'))['ownedRoots'])"`，2026-09-02）：

| ownedRoot | 内含关键文件 | 实证 |
|---|---|---|
| `src/components/chat/` | ChatInput.vue, ChatContextBar.vue, ChatBriefDialog.vue, ChatPanel.vue, selection-capture.ts, active-design.ts | ✓ 6 文件全在此根下，无须 patch 登记（T66/T65/T61 全在此） |
| `tests/engine/rebuild/` | 13 子目录含 marketing/image-gen/chat/studio/pi-backend/undo 等 | ✓ T66/T67/T68/T69/T70/T71/T72 测试全在此根下 |
| `src/app/i18n/fork/` | locales/en.ts, locales/zh-cn.ts, messages.ts, index.ts | ✓ T66/T70 i18n 双侧全在此 |
| `packages/core/src/tools/fork/` | fork/index.ts, fork/image-gen/{apply,history,index,requests,tools}.ts, fork/marketing/* 11 文件 | ✓ T66/T71 image-gen core 改造全在此 |
| `src/app/ai/pi-backend/` | image-gen/{routes,provider,client,generate,credentials,provider-types}.ts 等 | ✓ T66/T71 后端改造全在此 |
| `tools/rebuild/` | src/verify/t45-manifest-dump.mjs, t45-rewire-assembly-smoke.py | ✓ T67 修订脚本在此 |

**结论**: T66-T72 改动**全部位于 ownedRoots**，无越界文件，零登记漏项（核验命令：`git status --porcelain` rc=1 仅 docs/rebuild/records/review-2026-09-01-research-adjudication.md untracked；本报告本身）。

### 4.1 P-NN 全清单（核验命令：`python -c "import json; [print(p['id'], p['file']) for p in json.load(open('tools/zone-registry/zones.json'))['patches']]"`）

```
P1 src/router.ts                          P2 src/views/WorkspaceView.vue
P3 src/constants.ts                       P6 src/app/ai/chat/transports.ts
P7 src/app/ai/chat/use.ts                 P9 src/main.ts
P10 vite.config.ts                        P11 src/env.d.ts
P12 src/components/MobileHud/MobileHud.vue  P13 src/components/MobileHud/context.ts
P14 packages/vue/src/i18n/locale.ts       P15 packages/vue/src/i18n/create.ts
P16 tests/engine/vue/i18n/locale.test.ts  P17 package.json
P18 tsconfig.json                         P19 tools/unit-tests/src/shards.ts
P20 .github/workflows/ci.yml              P21 .lfsconfig (revoked)
P22 packages/core/src/tools/registry.ts   P23 bun.lock
P24 src/app/i18n/notifications/index.ts   P25 .github/workflows/ci.yml
P26 .github/workflows/ci.yml              P27 public/apple-touch-icon.png
P28 public/favicon-128.png                P29 public/favicon-32.png
P30 public/favicon.ico                     P31 .github/actions/setup-bun/action.yml
P32 .github/workflows/ci.yml (T64)        P33 src/components/editor/EditorWorkspace.vue
P34 knip.json                             P35 .github/workflows/ci.yml
P36 .gitignore                            P37 src/components/settings/models/ModelsPanel.vue
P38 packages/vue/src/i18n/messages/dialogs.ts (revoked)
P39 src/app/automation/bridge/tool-handlers.ts (T59)
P40 packages/vue/src/i18n/locales/zh-cn/dialogs.json (revoked)
P41 src/app/browser-bridge.ts             P42 tests/engine/scene-graph/plugin-data.test.ts
P43 .gitleaks.toml                        P44 src/components/settings/SettingsDialog.vue
P45 src/app/settings/dialog.ts            P46 src/app/settings/credentials/persistence.ts
P48 vite/server.ts                        P49 tests/e2e/chat/panel.spec.ts
P50 tools/type-shapes/src/files.ts        P51 packages/core/src/constants.ts (T27)
P52 src/app/ai/debug/index.ts (T27)       P53 tools/secret-scan/src/index.ts (T27)
P54 steiger.config.ts (T27)               P55 tools/architecture/src/steiger-rules/index.ts (T27)
P56 packages/mcp/src/browser-rpc.ts (T27) P57 .github/workflows/ci.yml (T28)
P58 README.md (T29)                       P59 AGENTS.md (T29)
P74 src/app/editor/clipboard/system.ts
P103-P106 package.json + mcp + e2e (T33/T36)
P107-P122 core text/font + ui (T30-T40 字体批次)
P124 oxlint.json                          P125-P129 packages/kiwi (T46 kiwi 批次)
P130 packages/core/src/bytes/index.ts (T55)
P131 packages/core/src/figma-api/index.ts (T55)
P132 packages/core/src/io/formats/raster/render.ts (T55)
P133 packages/core/src/io/formats/svg/defs.ts (T55)
P134 packages/core/src/tools/index.ts (T52)
P135 src/app/automation/bridge/figma-factory.ts (T55)
P136 src/app/automation/bridge/handlers.ts (T59)
P137 src/app/document/export/files.ts (T55)
P138 packages/core/src/tools/schema.ts (T72)
P139 packages/mcp/src/tool/registration.ts (T72)
P140 packages/mcp/src/tool/manifest.ts (T72)
```

> 编号空缺（P4/P5/P8/P47/P60-P73/P75-P102/P123）= 历史任务消化或留号未用；不在本批审查范围。

---

## 5. i18n 同步实证

> 范围：`src/app/i18n/fork/locales/{en,zh-cn}.ts`（T66-T72 所有改动均落在 fork zone）。

| key | en.ts 行 | zh-cn.ts 行 | 同步 | 备注 |
|---|---|---|---|---|
| `chipsCaptureSelection` | 94 | 38 | ✓ | T70 采集按钮 |
| `chipsCaptureEmpty` | 95 | 39 | ✓ | T70 空选区提示 |
| `chipsManifestFailed` | 92 | 36 | ✓ | T65/T66 残留 |
| `chipsRetry` | 93 | 37 | ✓ | T65/T66 残留 |
| `contextTriggerLabel` | 108 | 42 | ✓ | T66 双段 trigger |
| `contextTriggerDesignLabel` | 109 | 43 | ✓ | T66 双段 trigger |
| `contextTriggerDesignEmpty` | 110 | 44 | ✓ | T66 「待新建」 |
| `contextTriggerBriefsLabel` | 111 | 45 | ✓ | T66 双段 trigger |
| `contextTriggerBriefsEmpty` | 112 | 46 | ✓ | T66 「无」 |
| `targetSection` | 113 | 47 | ✓ | T66 当前目标卡 |
| `targetNoActive` | 114 | 48 | ✓ | T66 |
| `targetNoBriefBound` | 115 | 49 | ✓ | T66 |
| `designsSection` | 116 | 50 | ✓ | T66 |
| `designsEmpty` | 117 | 51 | ✓ | T66 |
| `designsActive` | 118 | 52 | ✓ | T66 |
| `designsSetCurrent` | 119 | 53 | ✓ | T66 |
| `designsSetting` | 120 | 54 | ✓ | T66 |
| `designsLocateHint` | 121-122 | 55 | ✓ | T66 |
| `designsSwitchFailed` | 123 | 56 | ✓ | T66 |
| `briefsSection` | 124 | 57 | ✓ | T66 |
| `briefListEmpty` | 125 | 58 | ✓ | T66 |
| `briefContainsActive` | 126 | 59 | ✓ | T66 |
| `briefNew` | 127 | 60 | ✓ | T66 |
| `briefNewPlaceholder` | 128 | 61 | ✓ | T66 |
| `briefCreate` | 129 | 62 | ✓ | T66 |
| `briefCreateCancel` | 130 | 63 | ✓ | T66 |
| `briefCreateFailed` | 131 | 64 | ✓ | T66 |
| `briefDirtyHint` | 132 | 65 | ✓ | T66 |
| `briefDiscardClose` | 133 | 66 | ✓ | T66 |
| `briefKeepEditing` | 134 | 67 | ✓ | T66 |
| `briefDialogTitle` | 135 | 68 | ✓ | T66 |
| `briefDialogDescription` | 136-137 | 69 | ✓ | T66 |
| `briefOpenFailed` | 138 | 70 | ✓ | T66 |
| `briefDialogMissing` | 139 | 71 | ✓ | T66 |
| `briefContent` | 140 | 72 | ✓ | T66 |
| `briefContentPlaceholder` | 141-142 | 73-74 | ✓ | T66 |
| `briefMaterials` | 143 | 75 | ✓ | T66 |
| `briefMaterialCaptionPlaceholder` | 144 | 76 | ✓ | T66 |
| `briefMaterialAdd` | 145 | 77 | ✓ | T66 |
| `briefMaterialAddSelection` | 146 | 78 | ✓ | T66 (params callable) |
| `briefMaterialRemove` | 147 | 79 | ✓ | T66 |
| `briefConclusions` | 148 | 80 | ✓ | T66 |
| `briefEmptySection` | 150 | 82 | ✓ | T66 |
| `briefSaved` | 151 | 83 | ✓ | T66 |
| `briefSaveFailed` | 152 | 84 | ✓ | T66 |
| `imageGenTitle` | 46 | 127 | ✓ | T66 image-gen 设置 |
| `imageGenDescription` | 47-48 | 128-129 | ✓ | T66 |
| `imageGenProvider` | 49 | 130 | ✓ | T66 P0+P1 |
| `imageGenBaseUrl` | — | 131 | ✓ | T66 P0+P1 |
| `imageGenBaseUrlPlaceholder` | — | 132 | ✓ | T66 P0+P1 |
| `imageGenModel` | — | 133 | ✓ | T66 P0+P1 |
| `imageGenModelPlaceholder` | — | 134 | ✓ | T66 P0+P1 |
| `imageGenKeyPlaceholderConfigured` | — | 135 | ✓ | T66 P0+P1 |
| `imageGenKeyPlaceholderMissing` | — | 136 | ✓ | T66 P0+P1 |
| `imageGenKeySave` | — | 137 | ✓ | T66 P0+P1 |
| `imageGenKeyClear` | — | 138 | ✓ | T66 P0+P1 |
| `imageGenConfigured` | — | 139 | ✓ | T66 P0+P1 |
| `imageGenNotConfigured` | — | 140 | ✓ | T66 P0+P1 |
| `imageGenOffline` | — | 141 | ✓ | T66 P0+P1 |
| ~~`imageGenTestConnection`~~ | rc=1 | rc=1 | ✓ 删除 | T71 移除测试连接 |
| ~~`imageGenTesting`~~ | rc=1 | rc=1 | ✓ 删除 | T71 移除测试连接 |
| ~~`imageGenTestSuccess`~~ | rc=1 | rc=1 | ✓ 删除 | T71 移除测试连接 |
| ~~`imageGenTestFailed`~~ | rc=1 | rc=1 | ✓ 删除 | T71 移除测试连接 |

**Vue 模板硬编码扫描**（核验命令：`grep -nE ">[一-龥]+<" src/components/chat/ChatInput.vue src/components/chat/ChatContextBar.vue src/components/chat/ChatBriefDialog.vue` rc=1，2026-09-02；`grep -nE "'[^']*[一-龥]+[^']*'" src/components/chat/ChatBriefDialog.vue` rc=1）——零硬编码中文文案残留。

**结论**: i18n 双侧 100% 同步，无硬编码 UI 文案。

---

## 6. 已知未覆盖（自我披露）

下列项**本次审查未做**或**无法做**——main agent 后续处置时应知会：

1. **运行时门禁复跑**：未跑 `bun test` / `bun run lint` / `bun run typecheck` / `bun run check:zones` / `bun run smoke:pi` 等。证据均为只读代码面（grep/Read/wc），门禁绿/红状态以三件套 + 自检 + 核验声明为采信源（T66-self-check §2、T67-self-check §4、T68-self-check §4、T69-self-check §4、T70-self-check §3、T71-self-check §3、T72-self-check §3、T72-verify §V8）。
2. **T45 t45-manifest-dump.json 实际产物 diff**：仅读 mjs 脚本（`tools/rebuild/src/verify/t45-manifest-dump.mjs`），未读 `verify-t45-manifest-dump.json` 实际产物（属 CI 产物，非审查面）。
3. **golden-watercolor-v2.test.ts 实际跑分结果**：仅审计测试文件结构（5 测试、372 行、`tests/engine/rebuild/marketing/golden-watercolor-v2.test.ts` 路径存在），未跑测试。
4. **T72 CI 红后补（commit b857f116）的 CI run 33516750532 实际日志**：仅采信 T72-self-check §5 自检 + T72-verify §V8 核验在案声明。
5. **上游合并面（packages/vue/src/）的 patch 冲突面**：本批任务均落 ownedRoots，零上游合并面改动；P38/P40/P21 三 revoked 不再 patch，已自洽。
6. **Playwright 交互实测**：按 T66-verify §3 + T70-verify §8 列入 W4 T-D 批次（不在本批 review 面）。
7. **T72 第 4 处遗漏面（CLI eval）实测**：本报告 P1-01 仅做 grep 实证（rc=0），未做运行时验证（CLI 是否真的零 ALL_TOOLS 消费）；建议 main agent 在 T73/T74 加一组钉扎。
8. **T62 撤回的 type 蓝图相关测试文件残留**：`grep -rn "type_blueprint\|TypeBlueprints" tests/ --include="*.ts"` 未跑（理论应 rc=1，但未实证）。
9. **watercolor_poster_v3.md 的 4 处 derive_palette** 是否会导致 `studio validate.ts` schema 校验失败：未跑 validate；T69-self-check §5 偏差登记「v3 不在本任务面」+ T67-self-check §4 门禁「studio 三套件全绿」间接在案，但未直接复跑 v3 单文件。

---

## 7. 给 main agent 的处置建议

按 P0→P3 顺序：

### P0 — 无

无 P0 项，可直接进 tracker flip / 集成交付。

### P1（owner 知会 / 加固）

**P1-01 · T72 CLI 防回归钉扎**
- **修法描述**（不实施）：在 `tests/engine/rebuild/image-gen/internal-visibility.test.ts` 新增 `test('CLI 包未消费 ALL_TOOLS/FORK_TOOLS/toolsToAI', () => { ... rc=1 })`，对 `packages/cli/src/**` 跑 `grep -rE "ALL_TOOLS|FORK_TOOLS|toolsToAI" packages/cli/src` 期望零命中；或在 `tools/architecture/` 加禁止引用规则。
- **关联文件**: `tests/engine/rebuild/image-gen/internal-visibility.test.ts:36-38`（现有钉扎区）/ `packages/cli/src/`（待钉扎区）
- **不阻塞提交**：仅加固，不属 bug。

**P1-02 · v3 profile `derive_palette` 待办**
- **修法描述**（不实施）：立 T73「v3 profile 改写或下架」——`src/app/ai/pi-backend/studio/profiles/watercolor_poster_v3.md` 4 处死链工具名（line 18/26/38/48）改写为「待 T73 改写轮处置」+ 一行 owner 决策脚注（保留/改写/下架）；或从 studio validate.ts 排除 v3（frontmatter 加 `skip_validation: true`）。
- **关联文件**: `src/app/ai/pi-backend/studio/profiles/watercolor_poster_v3.md:18/26/38/48`（4 处死链）/ `src/app/ai/pi-backend/studio/validate.ts`（schema 校验面）
- **不阻塞提交**：任务书显式不在本批面。

### P2（建议修，可并入下批）

**P2-01 · abort 长 HTTP 透传**
- 工具层 signal 透传（`generate.ts execute` 接 pi abort signal；`provider.ts` AbortSignal.timeout 串联 pi signal），归后续可选方向。

**P2-02 · routes.ts 4xx 文案 i18n 化**
- 错误码抽常量（`ERROR.API_KEY_REQUIRED` 等），后端返 `{error: code, params?: {...}}`，前端 catch 后用 `dialogs.value[code]` 转译。

**P2-03 · T66-verify §10 措辞**
- 改写为「A↔B 字面零交叉（image-gen/history 关键字 grep rc=1；marketing 导入仅是 A 自身职责，**非 B 跨界**）」

### P3（暂缓）

**P3-01/P3-02**: 不动——属设计取舍或零运行时影响。

---

## 附 · T66-T72 七任务三件套 vs 代码面对照速查

| 任务 | 三件套一致项 | 本 review 实证 |
|---|---|---|
| T66 ①状态双显收敛 | ChatInput.vue 空槽引导条删 + ChatContextBar 双段 trigger | ✓ ChatInput 模板 259-279 按钮 + ChatContextBar 252-262 双段 |
| T66 ②排版四件套 + dialog | createBriefOnPage 收尾四件套 + ChatBriefDialog 4 能力 | ✓ active-design.ts:312-333 + ChatBriefDialog.vue 406 行 |
| T66 ③fieldsHint 文案 | texts.ts:20 改写 | ✓ grep 实证 |
| T66 ④abort 守卫 | service.ts:468 改无条件 abort | ✓ |
| T66 ⑤备份页迁移 | history.ts getOrCreateBackupPage + placement.ts 跨页 seam | ✓ |
| T66 ⑥生图 P0-P5 | presets.ts 删 / provider.ts 重命名 / 4 字段凭证 / 测试连接 / response_format / description<2000 / 9 字段 schema | ✓（详见 T66-verify §7，13 grep 实证零残留） |
| T66 ⑦内部设施不外露 | generate.ts description 不暴露备份页名 | ✓ grep rc=1 |
| T67 marketing 孤儿退役 | 文件删 + t45/probe 复制清单去 marketing | ✓ ls prompts/ 仅 base.md + 两脚本注释「T67 复制清单只余 base」 |
| T68 longform 内容填充 | 156 行 / 9 项 / 工具 31 名对账 | ✓ `wc -l` 实证 + T68-verify V4 PASS |
| T69 v2 做透 + golden | canvas_width 绝迹 / Recipe 5 步 / 字阶正则 / 5 测试 | ✓ `grep derive_palette rc=1` + golden 372 行 |
| T70 内联 token + overlay | ChatInput overlay backdrop + 原子删除 + selection-capture 纯函数 | ✓ ChatInput.vue:283-313 + selection-capture.ts 全契约 |
| T71 测试连接移除 + 400 信封 | 13 符号零残留 + 全部 4xx sendJSON | ✓ |
| T72 internal 过滤 | schema.ts + 3 个 filter 面（pi-backend/mcp.registration/mcp.manifest）+ bridge 不过滤 + CLI 零消费 | ✓ P138/P139/P140 全部实证 |
