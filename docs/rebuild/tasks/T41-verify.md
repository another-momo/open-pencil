<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T41 核验报告 · 可变字体支持 + 字体白名单可视化管理

> **状态**：已完成 | **时间**：2026-08-30 | **核验人**：主 agent（探针实证 + Playwright 浏览器实证 + 基线对照取证）
> **基线**：`b8b3332c` + T41 改动（dev server localhost:1420 实跑，vite 热更含全部 T41 改动）
> **浏览器实证纪律**：Playwright MCP（owner 指令：不用 zcode 内置浏览器）；截图证据存仓外 `doc/`

## V1 S1 CanvasKit VF 探针（C1）✅

- 探针 `workbench/probe-t41-variable-font.mjs`（bun + canvaskit-wasm 0.41.1，2026-08-30 实跑）：下载 syst 真实分片（解析 result.css 选覆盖「中」/「A」的片），registerFont 后分别以 `fontVariations:[{axis:'wght',value:250}]` / `900` 排版绘制，readPixels 统计墨量。
- 结果：**CJK 墨量 900 档 = 250 档 × 2.81**（验收锚 > 1.2），对照组（仅 fontStyle.weight 不传 fontVariations）无显著差异 → **D-a 成立**：canvaskit-wasm 0.41.1 注册期无轴参数 API，VF 字重渲染由排版期 TextStyle.fontVariations 注入承载。

## V2 VF 资源面（C2）✅

- 单测：`bun test tests/engine/text/fonts/variable-fonts.test.ts` 13/13（2026-08-30）——合成 sfnt+fvar buffer 区间解析（读出/无 fvar null/截断不 throw）；findLocalFont VF 放宽（静态严格契约不变 / VF 任意字重接受 / 斜体一致约束 / 嗅探失败回 null）；VF 入账跟踪（isVariableFamily / variableWeightRange / evict 清理 / registerFontInBrowser 字重区间 descriptors，mock FontFace）；CDN VF 片入账。

## V3 CDN VF 包解析 + syst 回注册表（C3）✅

- 单测：cn-fonts.test.ts 22/22（T40 18 + T41 +4，2026-08-30）——「250 900」区间 font-weight 双值解析、区间包含选片、syst 形态端到端（index.json 单目录 + 区间 css mock fetcher）。
- registry.test.ts 10/10：CDN 六家族精确清单（syst 居首）+ syst `variable:true`/T0/OFL-1.1 标记 + 其余五族非 VF。

## V4 wght 轴排版注入（C4）✅

- 渲染层单测随文本套件全绿（`bun test tests/engine/text` 244/244，2026-08-30）：VF 家族未显式 variations 时按 fontWeight 注入（clamp 至 fvar 区间），显式 `node.fontVariations`/`run.style.fontVariations` 优先（FIG 导入语义不覆盖）；paraStyle 节点级 + pushStyleRun run 级双路径。
- 端到端渲染差异实证见 V7。

## V5 白名单管控（C5）✅

- 单测：`bun test tests/engine/text/fonts/allowlist.test.ts` 8/8（2026-08-30）——枚举过滤（bundled 锁定恒在且拒关 / cdn 关停隐藏重开恢复 / local 关停隐藏）；**includeDisabled 面板路径：关停行仍列出**（V6 面板 bug 修复的钉住用例）；四加载门禁 disabled → null；fallback local 循环跳过 disabled；revision 单调增 + replaceDisabled 滤除锁定族；normalize 归一（关停基名连带 "X Variable" 后缀）；syst 注册表 VF 标记。

## V6 设置面板（C6）✅

- Playwright 实证（2026-08-30，localhost:1420）：
  - 面板全貌：Settings → 字体分区列出 bundled 3 族（🔒 锁定 + 开关禁用态）+ cdn 6 族（syst 带「可变」徽标）+ online 2097 族 + local 未授权引导行；搜索框 + 「已启用 N/M 个家族」摘要（`doc/t41-c2-panel.png`）。
  - 关停 syst：localStorage `op-font-disabled-families:v1` 持久化，picker 搜索 "Source Han" → 0 选项（`doc/t41-c2-panel-disabled.png` / `doc/t41-c3-picker-hidden.png`）。
  - **实证挖出的真 bug + 修复复验**：首版面板用过滤枚举，关停行消失且摘要分母缩水（实测 2105/2105）；修复为不过滤枚举后复验三态——关停后行留存开关关态 + 摘要 2105/2106（`doc/t41-fix-panel-disabled-row.png`）→ 重开 2106/2106 且 localStorage 清空（`doc/t41-fix-panel-reenabled.png`）→ picker 恢复列出 syst 唯一选项（`doc/t41-fix-picker-restored.png`）。修复细节见 [T41-self-check.md §3 第 1 条](T41-self-check.md)。

## V7 VF 浏览器渲染实证（C7）✅

- 链路：画布建 TEXT 节点（family 'Source Han Serif CN VF'，同文案）→ CDN 子集链加载（jsdelivr 实拉，source='cdn'，10 片 alias，内存账本 971KB / 50MB 预算内）→ 仅改 fontWeight 250 vs 900 → 截图对比。
- 证据（`doc/` 仓外证据区，2026-08-30）：
  - `doc/t41-c1-vf-wght250.png`：细衬线 Light 形态；
  - `doc/t41-c1-vf-wght900.png`：重衬线 Black 形态——同一 VF 家族同一节点仅字重不同，粗细/墨量差异肉眼可辨，wght 轴注入端到端生效。
- 过程记录：900 档首渲染空白系分片加载中 readiness 门跳过绘制（设计行为），加载完成后正常重绘——见 [T41-self-check.md §3 第 4 条](T41-self-check.md)。

## V8 门禁 + 全量基线对照（C8）✅

- 门禁九项全绿，实测表见 [T41-self-check.md §2](T41-self-check.md)（tsgo / vue-tsc / lint 0 error / format:check / check:zones clean / check:docs 40/40 / check:tasks / check:bindings / check:i18n / 文本套件 244/244，2026-08-30）。
- `test:unit:quick` 两轮定谳（浏览器 + dev server 关闭后实跑，全量日志 `doc/t41-quick-full.log`）：**77 fail / 2615** 与 **76 fail / 2626 / 430 files**，对照 T40 基线 78 fail / 2600 / 428——失败数不增，**失败清单零 T41 触改文件**，失败簇构成与 T39/T40 已登记 flake 一致（headless CanvasKit `/D:/` ENOENT 簇 139 行签名 / MCP-CLI 端口时序簇 / window-mock 污染簇——隔离复跑 35/35 全绿 / 1 例网络依赖）。详表见 [T41-self-check.md §4](T41-self-check.md)。

## V9 三件套 + 登记（C9）✅

- 三件套：T41-plan.md（状态翻 ✅）/ T41-self-check.md / 本文。
- 登记：tracker.md + tasks/_index.md T41 行翻 ✅（check:tasks/check:zones 复验绿）；zones.json patch P121/P122 新增 + P44/P45/P107/P109/P119 reason 扩展 + ownedFiles 5 项（check:zones clean，2026-08-30）。
- 截图与定谳日志归位仓外 `doc/`（18 张 t41-*.png + t41-quick-full.log，遵 owner 纪律）。

## 结论

C1-C9 全过。**两条能力链均已打通并经浏览器实证**：①可变字体——资源面全来源放行（bundled/local/CDN）+ fvar 嗅探入账 + 排版期 wght 轴自动注入（显式 variations 优先）+ syst（思源宋体 CN VF）以区间字重形态回注册表，250/900 渲染差异肉眼可辨；②白名单可视化管理——Settings 字体分区覆盖 bundled/cdn/online/local 全来源逐族开关（bundled 兜底锁定恒开），localStorage 持久化，picker 经 revision 信号即时失效重拉，「视为未安装」语义由四加载门禁 + fallback 跳过承载。D-e（push 托管）维持推延。
