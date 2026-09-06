<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T25-verify.md · T25 独立核验记录

> **T 编号**：T25（Phase 1-pi 实施 · 减法收口）
> **状态**：✅ 已核验（2026-08-24 独立 subagent 执行；核验员非实施者）

## 核验项（预审自 [T25-plan.md §2](T25-plan.md) 验收清单 C1-C6 派生）

| #   | 核验项                                                                             | 结果 | 证据节 |
| --- | ---------------------------------------------------------------------------------- | ---- | ------ |
| V1  | 代码与自述一致（D1-D4 落地形态：三路径收敛单 pi、门退役、override 钩子保留）       | ✅   | §V1    |
| V2  | 可运行验证（C3 门禁 + C4 冒烟回归全绿）                                            | ✅   | §V2    |
| V3  | 一键启动实测证据链（C5：干净 shell 一条命令 → 后端自起 + 浏览器自开 → 活模型回合） | ✅   | §V3    |
| V4  | 切除面无残留无误伤（C1 grep 零残留 + 清单外文件零触碰 + 既有功能回归）             | ✅   | §V4    |
| V5  | 边界登记完整性（plan §1.3 不做项、analyze 退化登记、ProviderSetup 处置登记）       | ✅   | §V5    |
| V6  | 卫生（无 fixture 改动、无密钥、无本机残留入库、zones 删除登记齐全）                | ✅   | §V6    |

### V1 证据

核验日期 2026-08-24，逐项实证：

1. **transports.ts 收敛为 override 唯一来源**：`cat src/app/ai/chat/transports.ts`——无 `createToolLoopTransport`/`createActiveHarnessTransport` 任何痕迹，`createTransport()`（transports.ts:61-67）在无 override 时抛「Chat transport is not registered (pi backend attach missing)」，override 即唯一来源；T22 历史回填/失败分类/WeakMap 暂存保留（transports.ts:76-100）。命令 `grep -n "createToolLoopTransport\|createActiveHarnessTransport\|isHarnessProvider" src/app/ai/chat/transports.ts src/app/ai/chat/use.ts src/app/ai/pi-backend/attach.ts` 零命中（exit 1）。
2. **use.ts 无门无 isConfigured**：`cat src/app/ai/chat/use.ts`——导出面仅 activeTab + ensureChat/resetChat/chatFailure/clearChatFailure + stock-photo/remember re-export（use.ts:38-52）；`grep -n "VITE_PI_BACKEND\|isConfigured" src/app/ai/chat/use.ts src/app/ai/pi-backend/attach.ts` 零命中（exit 1）。
3. **attach.ts 恒注册**：`cat src/app/ai/pi-backend/attach.ts`——仅 IS_BROWSER 守卫（attach.ts:23），无 env 门；调用点 `grep -rn "attachPiBackendTransport" src/` → `src/main.ts:11 attachPiBackendTransport()` 顶层无条件调用。
4. **override 钩子保留（D4）**：`grep -n "setChatTransport" src/app/browser-bridge.ts` → 24/67/69 三行在位（类型声明 + 实现 + window.openPencil 挂载）。browser-bridge.ts:52 的 `import.meta.env.DEV` 是桥自身 dev 守卫，非 VITE_PI_BACKEND 门。

### V2 证据

核验日期 2026-08-24，全部本机实跑：

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| tsgo | `bunx tsgo --noEmit` | exit 0 |
| vue-tsc 根 | `bunx vue-tsc --noEmit -p tsconfig.json` | exit 0 |
| vue-tsc vue 包 | `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` | exit 0 |
| lint | `bun run lint` | exit 0（0 errors；3 件 max-lines warning 全在 packages/core/src/design-jsx/，T25 面外存量） |
| i18n | `bun run check:i18n` | 「All locale files are in sync.」 |
| zones | `bun run check:zones` | 「clean: 45 modified / 248 added / 1012 deleted 全登记，base 5201404f」 |
| docs | `bun run check:docs` | 38/38 通过 |
| deps | `bun run check:deps` | exit 0（knip 零输出） |
| arch | `bun run check:arch` | 「No problems found!」 |
| monorepo | `bun run check:monorepo` | 「No issues found」 |
| tools | `bun run test:tools` | 4 pass / 0 fail |
| type-shapes | `bun run test:type-shapes` | 「No duplicate object type shapes found.」 |
| packages | `bun run check:packages` | metadata/publint/attw 三句全过 |
| format | `bun run format` 后 `git status --porcelain \| wc -l` | 仍 92 件零漂移——format 收敛实证 |

环境受限两件（失败模式实证为环境原因，与 [T25-self-check.md §3.3](T25-self-check.md)-2 一致）：

- `bun run check:secrets` → 「Secret scan failed.」；实证 `which gitleaks go` 双双不在 PATH，`tools/secret-scan/src/index.ts:20` 的 spawn 链（gitleaks → go run 兜底）无二进制可跑——ENOENT 环境性失败，非内容命中。
- `bun run check:audit` → 「audit request failed (status 404)」；实证 `~/.npmrc` 为 `registry=https://registry.npmmirror.com`（无 audit bulk 端点）——registry 环境性 404。

`bun run test:unit:quick`（exit 127）：99 件失败分布 33 套件，全在 fig 导出/字体/canvaskit/eval CLI/ws 桥/render/vectorize/scene-graph 面；失败原因抽样实证环境性——41 件 `canvaskit.wasm ENOENT`（Windows 路径 `/D:/...` 错位）、字体下载/缓存、ws guard 超时、eval 超时。对 33 件失败套件逐件 `grep -lE "ai/chat/(storage|model|reasoning|connection-test)|ai/attachment|ai/models|ai/providers|ai/harness|vision-runtime|tools/vision|integrations/mcp|credentials/migration|VITE_PI_BACKEND"` 零命中——失败套件不导入任何已删模块，与 T25 切除面无交集。

### V3 证据

核验日期 2026-08-24：

1. **key-env 注入实现审查**（`cat src/app/ai/pi-backend/main.ts:23-37`）：`if (process.env.OPENROUTER_API_KEY) return`（main.ts:24）——只在 key 缺失时读 `.openpencil/key-env`；逐行注入时 `if (process.env[name]) continue`（main.ts:31）——不覆盖已有 env；全文件无 key 打印（仅 listen 日志输出端口/pid，main.ts:56）。
2. **server.open**（`cat vite/server.ts:28-30`）：`open: !host`——Tauri host 注入时不弹浏览器，注释在位。
3. **resolveConfig 实证**：临时 node 脚本调 `resolveConfig({configFile: vite.config.ts}, 'serve')` → 输出 `server.open = true`、`proxy keys = /api/pi`、`/api/pi proxy = {"target":"http://127.0.0.1:7700","changeOrigin":false}`（脚本跑完即删）。
4. **key-env 注入端到端实证（超出 self-check 证据强度的独立复验）**：本机 shell 无 OPENROUTER_API_KEY（`echo ${OPENROUTER_API_KEY:+set}` 空）；`env -u OPENROUTER_API_KEY bun run src/app/ai/pi-backend/main.ts` 起后端 → `/health` 200 → `/api/pi/catalog` 中 openrouter `configured: true`——注入链真实生效。跑后 `taskkill //PID 5504 //F` + `netstat` 实证 7700 已释放（无孤儿）。
5. **C5 证据链合理性审查**（[T25-self-check.md §3.1](T25-self-check.md)-10）：净 shell `bun run dev` → vite 200 + /health ok + catalog configured:true 的声明与上述 1-4 独立实证互洽；浏览器自动开在 agent shell 不可观测的限制已登记于 [T25-self-check.md §3.3](T25-self-check.md)-5，证据止于 resolveConfig 级属如实声明。未重跑 LLM 回合（按要求）。

### V4 证据

核验日期 2026-08-24：

1. **指定 grep 零命中**：`grep -rn "from '@/app/ai/chat/storage'" src/ tests/` 等 6 组 import 模式 + `vision-runtime|tools/vision|credentials/migration|VITE_PI_BACKEND` + `ProviderSetup|ProfileEditor|RoleAssignments|ChatProfileSelect|ProviderModelSelect|ProviderConnectionTestButton` 全部零命中；唯一命中是 `tests/e2e/chat/panel.spec.ts:151` 注释 + 同文件 155 行 `provider-setup-open-settings` 的 `toHaveCount(0)` 否定断言——断言旧门不存在，属验收意图本身。
2. **自查 C1 模式复跑**：`grep -rnE "from '@/app/ai/(chat/(storage|model|reasoning|connection-test)|attachment|models|providers|harness|vision-runtime|tools/vision)'|integrations/mcp|credentials/migration" src/ tests/` 零命中（exit 1）。
3. **git status 对账**（`git status --porcelain` 共 92 件 = 60 D + 30 M + 2 ??）：删除面与 [T25-self-check.md §3.0](T25-self-check.md) 逐族一致（harness 包 14 件、attachment/models/providers/harness/integrations-mcp/settings-mcp 整目录、组件 8 件、测试 8 件 + acp-session helper）；修改面与 §3.1 一致；新增恰为 stock-photo-keys.ts + media-credentials.ts 两件。`git status --porcelain | grep tests/fixtures` 零命中。
4. **整删目录磁盘实证**：`packages/harness`、`src/app/ai/{attachment,models,providers,harness}`、`src/app/integrations/mcp`、`src/components/settings/mcp`、`src/components/chat/attachment` 八处全部不存在。
5. **清单外文件零触碰抽查**：`git diff src/app/ai/pi-backend/mapping.ts src/app/ai/pi-backend/vite-plugin.ts` 为纯注释改动（失效引用注记 + key-env 头注），行为零变更；pi-backend server.ts/service.ts/tools.ts 不在改动清单（plan §1.3 遵守）。
6. **保留件自洽**：`cat src/app/settings/credentials/media-credentials.ts`——仅 import `./reference`，叶子无环；`grep "^import" src/app/settings/credentials/persistence.ts`——persistence 不 import stock-photo-keys（环已破）；stock-photo-keys.ts 消费者仅 chat/use.ts（re-export 枢纽）；`grep "aiModelSettings\|modelConnectionCredentialRef\|mcpConnectionSettings" persistence.ts` 零命中。
7. **登记一项残留（非阻断）**：全仓扫描发现 `VITE_PI_BACKEND` 仍存活于两件用户可见 i18n 文案——`packages/vue/src/i18n/messages/dialogs.ts:187` 与 `locales/zh-cn/dialogs.json:96` 的 `piCatalogOffline`（「start the dev server with VITE_PI_BACKEND=1」），消费者为 `PiModelsPanel.vue:168`（grep 实证）。门已退役，该恢复指引文案过时；zones.json 内 3 件同名命中为历史注记，属正常。此项在指定 grep 范围（src/ tests/）之外、不影响行为，建议后续顺手清理。

### V5 证据

核验日期 2026-08-24（读 [T25-self-check.md §3.3](T25-self-check.md) 与 [T25-plan.md §1.3](T25-plan.md) 逐条比对）：

- §3.3 五项边界全登记：①analyzeAttachedImages 随 attachment 族切除的知情退化（C4a 恢复）；②secrets/audit 本机环境受限；③unit quick 环境性失败；④T20 tool-smoke keeper 依赖（一次性包装复跑）；⑤server.open 浏览器弹窗在 agent shell 不可观测。
- plan §1.3 不做项遵守实证：pi-backend server/service/tools 零改动（git status 无此三件，mapping/vite-plugin 仅注释——见 §V4-5）；Chat 类零改动（@ai-sdk/vue 包无补丁）；7600 桥与 packages/mcp 不动（`ls packages/` mcp 在位且 git status 无 entries）；改动清单无 C4a/C3a/F0.3② 相关文件；packages/harness 为纯删除（git 历史保留）。
- ProviderSetup 处置登记在案（[T25-self-check.md §3.0](T25-self-check.md) 拆分保留段 + §3.1-3：isConfigured 随 ProviderSetup 删除，pi 语义为后端首个 prompt 如实报错）。

### V6 证据

核验日期 2026-08-24：

1. **fixtures 零触碰**：`git status --porcelain | grep tests/fixtures` 零命中；`.gitattributes:1-2` 实证 LFS 面（`tests/fixtures/*.fig` + `tests/fixtures/fonts/*.ttf`），`git check-attr filter` 抽查 circle-text/gold-preview/material3/nuxtui 四件 .fig 均 lfs，均不在改动中。
2. **无本机残留入库**：git status 92 件中无 `.openpencil/` 任何 entry；`.gitignore:82` 为 `.openpencil/`。
3. **无 key 明文**：`git diff` 全量扫描（`sk-or-|api_key.*['"]<20位以上>|password|secret` 模式）零真实 key 命中；唯一字样是 allowlist 内 dummy `sk-or-test-key-12345`（现存于 t24/prompt-assembly-smoke.mjs 两件 POST 体 + `.gitleaks.toml:35` allowlist，diff 中无新增 sk-or 行——原有一件为删除行）。`src/app/ai/pi-backend/main.ts` 与六件冒烟脚本改动均不接触 key 本体。
4. **zones 登记齐全**：deletedPaths 现有 87 件，diff 实证 T25 新增 30 件删除登记（与 [T25-self-check.md §3.1](T25-self-check.md)-8「+30」一致；另 1 件 `tests/helpers/tauri/windows-input.ts` 为 phase0 commit f4efaff7 已删文件的补登记）；60 件 git 删除全部被 dir 级 + 文件级条目覆盖（python 逐件比对零遗漏）；ownedFiles 含两件新文件；patches P44-P50 全存在；pendingReclass 摘除 providers/models/attachment/vision-runtime 四件与 §3.1-8 一致。附带观察：stubs 摘除 `src/app/collab/use.ts`（该文件 8-19 已是实文件，属存量簿记修正，§3.1-8 未列，`check:zones` clean 佐证登记自洽）。
5. **冒烟脚本头注**：`head -12` 六件（smoke/browser-smoke/t21/t22/t23/t24）——前置条件均为「vite dev server 已起（T25 D3 后门退役…）」或「不需要 LLM key」，无一要求 `VITE_PI_BACKEND=1`；`spikes/s-pi/README.md` diff 同步改写为「需 dev server 与 key；T25 D3 后门退役」。

## 总结论

**可以收口。** V1-V6 全 ✅：三路径收敛单 pi、门退役、override 钩子保留与自述一致；门禁族本机全绿（secrets/audit/unit 失败均实证为环境性且与切除面零交集）；一键启动的 key-env 注入链经独立净 env 实证生效；60 删/30 改/2 增与登记逐件对账无遗漏无误伤；边界与卫生项齐全。

附带一项非阻断残留（已登记 §V4-7）：`piCatalogOffline` i18n 文案（en + zh-cn）仍建议「VITE_PI_BACKEND=1 启动」，门退役后属过时指引，建议后续任务顺手改为「bun run dev」表述——不阻断 T25 验收（文案非行为，且在指定验收 grep 范围之外）。
