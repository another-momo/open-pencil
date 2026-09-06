# T90-self-check · T88 遗留 bug 修复（七门禁 + 测试钉扎）

> **状态**：✅ 完成 | **时间**：2026-09-03
> **任务来源**：owner 实测 + `docs/202609031430-t88-console-errors.md` 控制台报错分析（仓外文件）
> **关联**：T88 节点名 CJK 豆腐字修复——本任务收口 T88 引入的两个 bug

## 1. 改动文件清单

### 代码（2 改）

| 文件                                         | 改动                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/recovery/RecoveryDialog.vue` | 第 2 行 import 补 `AlertDialogDescription, AlertDialogTitle`                                                                                                                                                                                                                                         |
| `packages/core/src/canvas/renderer/fonts.ts` | `loadFonts` 内 dispose 顺序改为 Replace-before-delete（一)：快照旧 Font → assignScriptFonts 替换 r 字段 → delete 旧 Font）；删 `disposeAllFontInstances` 死码；`assignScriptFonts` 由「snapshot target 对象再整体替换」改为「直接写 r 字段」（删 `scriptFontTarget` + `ScriptFontTarget` interface） |

### 测试（1 建）

| 文件                                                | 改动                                                                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/render/canvas/font-lifecycle.test.ts` | 新建——mock CanvasKit，记录 Font.delete() 调用顺序，断言：**任何 Font.delete() 的调用之前，对应字段已被新 Font 替换**（即 r.textFont 不再指向被 delete 的 Font）；连续三次重载零泄漏；首次/重载/连续三轮三场景钉死 |

### 治理（4 改/建）

| 文件                                   | 内容                                             |
| -------------------------------------- | ------------------------------------------------ |
| `docs/rebuild/tasks/T90-plan.md`       | 新建（含 assignScriptFonts 直写 r 字段二次发现） |
| `docs/rebuild/tasks/T90-self-check.md` | 新建（本文件）                                   |
| `docs/rebuild/tasks/T90-verify.md`     | 新建                                             |
| `docs/rebuild/tasks/_index.md`         | 追加 T90 行                                      |
| `docs/rebuild/tracker.md`              | 追加 T90 行                                      |

## 2. 测试钉扎（3 例新增）

| 文件                                                           | 用例数 | 状态                 |
| -------------------------------------------------------------- | ------ | -------------------- |
| `tests/engine/render/canvas/font-lifecycle.test.ts`            | 3      | 3/3 pass             |
| `tests/engine/rebuild/pi-backend/capabilities.test.ts`         | 9      | 9/9 pass（无回归）   |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | 6      | 6/6 pass（无回归）   |
| `tests/engine/rebuild/chat/selection-capture.test.ts`          | 30     | 30/30 pass（无回归） |

## 3. 关键调试发现（超出 plan 范围）

首轮单测三例全部 fail：r.textFont 仍指向 initial-text（已 delete，deleteOrder=1）。调试路径：

1. 加 try/catch + console.error → loadFonts 未抛错，deleteOrder 只走了一次（说明只有第一个旧 Font 被 delete 了，但 r.textFont 字段没被替换）
2. 检查 `assignScriptFonts`：函数把 5 个 r 字段快照进新对象 `target` 后，对 `target` 做赋值——这是 dead write，r 上的字段从不被改

修复：删除 `scriptFontTarget` + `ScriptFontTarget` 死码，`assignScriptFonts` 三个分支直接 `r.textFont = ...` / `r.cjkTextFont = ...` / `r.arabicTextFont = ...` 赋值。

该 bug 是 T88 引入的——`scriptFontTarget` 在 T88 commit（`bd1697dab`）里就是 snapshot 写法，但当时未写 unit test 覆盖 assignScriptFonts 写入路径（仅画布真渲染 e2e 覆盖，碰巧没踩到销毁路径），T88 实际跑在浏览器里也只是当 capabilities 不变时 loadFonts 不会重入，没崩——但只要重载就会触发 BindingError。

## 4. 七门禁

| 门禁 | 状态 |
|------|------|
| `bun run lint` | ✅ 0 errors（7 warnings 均为 max-lines pre-existing，不在本任务修复范围） |
| `bunx tsgo --noEmit` | ✅ 0 errors |
| `bunx oxfmt --check`（仅 T90 触碰文件） | ✅ all matched files use the correct format |
| `bun run check:vue` (vue-tsc) | ✅ 0 errors |
| `bun run check:i18n` | ✅ all sync |
| `bun run check:zones` | ✅ clean: 93 modified (all registered), 627 added (owned), 1019 deleted (all registered), 0 renamed, base 88c10770（P150 新增 + 新测试文件入 ownedFiles + T31 tarball.paths 移除 RecoveryDialog 三处变更） |
| `bun run check:docs` | ✅ 44/44 pass（R1-R5） |
| `bun run check:tasks` | ✅ P150 新增；大改动 T89 三件套齐 |

## 5. 偏离声明

**plan 之外的额外修复**：`assignScriptFonts` 由「snapshot 替换」改为「直接写 r 字段」。这是 T88 埋下的 bug，触发场景 = loadFonts 重入（capabilities 切换 / fonts 重载），T88 e2e 没踩到。补单测覆盖即钉死。

## 6. 风险

- `disposeAllFontInstances` 函数删除后，lifecycle.ts 的 `disposeFonts` 不依赖此函数（destroy 路径独立，逐字段 delete + clear refs）——零回归
- `oldFonts` 数组快照后 `assignScriptFonts` 三次调用，期间 r.textFont/cjkTextFont/arabicTextFont 等字段被新 Font 替换——`oldFonts` 数组仍持有旧引用；最后 for-loop 安全 delete
- `r.isDestroyed()` 检查点保持不变——T88 已有 `if (r.isDestroyed()) return` 在 Promise.all 之后；本替换操作在 isDestroyed 检查之后执行，如 destroy 发生在 assignScriptFonts 期间，r 字段仍指向新对象（destroy path 由 lifecycle.ts:disposeFonts 负责清，与本路径独立）
