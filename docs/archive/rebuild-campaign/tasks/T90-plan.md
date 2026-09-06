# T90-plan · T88 遗留 bug 修复

> **任务来源**：owner 实测 + `docs/202609031430-t88-console-errors.md` 控制台报错分析（仓外文件）
> **关联**：T88 节点名 CJK 豆腐字修复——本任务收口 T88 引入的两个 bug

### 背景与动机

T88 施工后浏览器控制台出现两类报错：

**问题一**：Vue 组件解析失败

- `RecoveryDialog.vue` 模板用了 `AlertDialogTitle` / `AlertDialogDescription` 但未从 reka-ui 导入
- 修复：补 import 即可

**问题二**：CanvasKit 字体 BindingError

- `Cannot pass deleted object as a pointer of type Font` 在 `drawHorizontalRulerTicks` (rulers.ts:76) 处触发
- 根因：T88 引入 15 个 Font 实例（5 latin + 5 cjk + 5 arabic）后，`fonts.ts:loadFonts` 用了"先批量删除旧 15 个 Font，再创建新的"的顺序——删除后到创建前的间隙中，`r.textFont`（等）仍指向已删除的 Font 引用，渲染路径访问即崩
- 修复：采用 CanvasKit 官方建议的 "Replace before delete" 模式——先创建新 Font 替换 r 字段引用，再释放旧 Font（无引用，安全 delete）

### 方案概览

#### 改动 1：RecoveryDialog.vue import

- `src/components/recovery/RecoveryDialog.vue` 第 2 行 `import { AlertDialogCancel } from 'reka-ui'` 扩为 `import { AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from 'reka-ui'`

#### 改动 2：fonts.ts Replace-before-delete

- `packages/core/src/canvas/renderer/fonts.ts` `loadFonts` 内删除 disposeAllFontInstances(r) 调用
- 替换为：1) 快照旧 Font 引用 → 2) assignScriptFonts 三次（创建新 Font 并替换 r 字段） → 3) 删除旧 Font
- 删除 `disposeAllFontInstances` 函数（死码，单源下永不再调用；lifecycle.ts:disposeFonts 走逐字段 delete 的 destroy 路径独立存在，与本修复无关）

#### 改动 3：assignScriptFonts 直写 r 字段

- 单测首轮发现 Replace-before-delete 仍不生效：r.textFont 仍指向已 delete 的旧 Font
- 根因：`assignScriptFonts` 用 `scriptFontTarget(r, script)` 返回一个**新对象**（五个字段快照），然后对快照对象做 `target[kind] = newFont` 赋值——赋值不会回到 r 上，等于 no-op
- 修复：删除 `scriptFontTarget` + `ScriptFontTarget` interface，直接在 `assignScriptFonts` 内对 `r.textFont` / `r.cjkTextFont` / `r.arabicTextFont` 等 15 个字段逐个赋值

### 改动清单（3 文件）

#### 代码（2 改）

| 文件                                         | 改动                                                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/recovery/RecoveryDialog.vue` | 第 2 行 import 补 `AlertDialogDescription, AlertDialogTitle`                                                                                                                                                             |
| `packages/core/src/canvas/renderer/fonts.ts` | `loadFonts` 内 dispose 顺序改为 Replace-before-delete；删 `disposeAllFontInstances` 死码；`assignScriptFonts` 由「snapshot target 对象再整体替换」改为「直接写 r 字段」；删 `scriptFontTarget` + `ScriptFontTarget` 死码 |

#### 测试（1 改/建）

| 文件                                                | 改动                                                                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/render/canvas/font-lifecycle.test.ts` | 新建——mock CanvasKit，记录 Font.delete() 调用顺序，断言：**任何 Font.delete() 的调用之前，对应字段已被新 Font 替换**（即 r.textFont 不再指向被 delete 的 Font） |

#### 治理（5 改/建）

| 文件                                   | 内容               |
| -------------------------------------- | ------------------ |
| `docs/rebuild/tasks/T90-plan.md`       | 新建（本计划摘要） |
| `docs/rebuild/tasks/T90-self-check.md` | 新建               |
| `docs/rebuild/tasks/T90-verify.md`     | 新建               |
| `docs/rebuild/tasks/_index.md`         | 追加 T90 行        |
| `docs/rebuild/tracker.md`              | 追加 T90 行        |

### 验收

- 七门禁全绿（本任务文件 lint/tsgo/format/vue/zones/i18n/docs）
- 引擎测试：font-lifecycle.test.ts 新例全过；现有 render/canvas 套件零回归
- 浏览器实测：capabilities ON → drop 一份含中英文的 SKILL.md 在 `.openpencil/skills/` → 控制台 0 报错；触发 loadFonts 重载（如切换 capabilities OFF → ON）→ rulers 路径不触发 BindingError

### 风险与边界

1. `disposeAllFontInstances` 函数删除后，lifecycle.ts 的 `disposeFonts` 不依赖此函数（destroy 路径独立，逐字段 delete + clear refs）——零回归
2. `oldFonts` 数组快照后 `assignScriptFonts` 三次调用，期间 r.textFont/cjkTextFont/arabicTextFont 等字段被新 Font 替换——`oldFonts` 数组仍持有旧引用；最后 for-loop 安全 delete
3. **`r.isDestroyed()` 检查点保持不变**——T88 已有 `if (r.isDestroyed()) return` 在 Promise.all 之后；本替换操作在 isDestroyed 检查之后执行，如 destroy 发生在 assignScriptFonts 期间，r 字段仍指向新对象（destroy path 由 lifecycle.ts:disposeFonts 负责清，与本路径独立）
