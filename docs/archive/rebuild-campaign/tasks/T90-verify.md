# T90-verify · T88 遗留 bug 修复（验收对照 + 端到端真值再生）

> **状态**：✅ 已完成 | **时间**：2026-09-03
> **关联**：T88 节点名 CJK 豆腐字修复——本任务收口 T88 引入的两个 bug（Vue import + CanvasKit BindingError）

## 验收对照

| 项                                            | 计划                                                  | 实测                                                                                                                                                            | 通过 |
| --------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| RecoveryDialog 补 import                      | AlertDialogTitle + AlertDialogDescription 加入 import | `RecoveryDialog.vue` 第 2 行 `import { AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from 'reka-ui'`                                            | ✅   |
| fonts.ts Replace-before-delete                | 1) 快照旧 Font → 2) 替换 r 字段 → 3) delete 旧 Font   | `loadFonts` 内三步顺序实现（lines 364-390）                                                                                                                     | ✅   |
| 删 disposeAllFontInstances 死码               | 单源下永不再调用                                      | 函数已删除；lifecycle.ts:disposeFonts 走 destroy 路径独立存在                                                                                                   | ✅   |
| assignScriptFonts 直写 r 字段                 | 不再 snapshot 替换（plan 外发现）                     | 三分支直接 `r.textFont = ...` / `r.cjkTextFont = ...` / `r.arabicTextFont = ...`；`scriptFontTarget` + `ScriptFontTarget` 已删                                  | ✅   |
| font-lifecycle 单测覆盖 replace-before-delete | 钉死 r.textFont 不再指向被 delete 的旧 Font           | 3 例新增全过                                                                                                                                                    | ✅   |
| 引擎测试零回归                                | render/canvas 套件不因 T90 改动新增失败               | capabilities 9/9 + service-capabilities 6/6 + selection-capture 30/30 不变；render/canvas 9 失败均为 canvaskit.wasm 缺文件环境问题，与 T90 无关（基线对比验证） | ✅   |

## 端到端真值再生

dev server 起动后（capabilities ON）：

1. 浏览器控制台 0 报错（之前 `RecoveryDialog.vue` 模板报「Failed to resolve component: AlertDialogTitle」已修复）
2. capabilities ON → drop 一份含中英文的 SKILL.md 在 `.openpencil/skills/` → 控制台 0 报错（之前 loadFonts 重入 rulers.ts:76 报 `Cannot pass deleted object as a pointer of type Font` 已修复）
3. 触发 loadFonts 重载：capabilities OFF → ON（连续 3 次切换）→ rulers 路径不触发 BindingError
4. 单测验证：`bun test tests/engine/render/canvas/font-lifecycle.test.ts` → 3 pass / 0 fail
