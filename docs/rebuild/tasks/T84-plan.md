# T84 plan——浏览器端 CJK 渲染收窄修复（bundled 字体前插回退链）

> **立项**：2026-09-02 owner 指令（TodoProposals 字体提案的收窄版）。原提案
> `docs/TodoProposals/202609010000-bundle-font-optimization.md` 经核实：现状描写准确，
> 但删 PuHuiTi/换 Inter VF/绑 LXGW 的大替换版不可执行（营销流 BRIEF_FONT_FAMILY 硬依赖、
> 体积数字无据、改动面低估 4 倍）。本任务只做收窄后的安全增量。
> **注意**：父仓文档引用写作 TodoProposals 实际路径为父仓 docs/TodoProposals/（非 worktree）。

## §1 定谳

### 定谳 1（范围）：只做「bundled 中文字体前插 CJK 回退链」，其余一律不动

- ✅ 做：浏览器端/无系统字体权限时，中文回退落不到本地字体的真实痛点修复。
- ❌ 不做：删 PuHuiTi 任何字重、改 BRIEF_FONT_FAMILY、Inter VF 化、LXGW WenKai 下载
  （断网 + 官方 VF 存在性未证实 + 缺子集化工序，全部留待单独裁决）。

### 定谳 2（前锋字体选型）：用已 bundled 的 Alibaba PuHuiTi Regular，零新资产

理由：① 已 bundled（public/ + packages/core/assets/ 双份在册），断网可施工；
② 已经 `tools/font-subset/charset-cjk.txt` 承诺字符集子集化（覆盖率见该文件头注，
~11 个边缘字缺失属可接受面）；③ base.md 本就指导 AI 中文默认 PuHuiTi——回退面与
产品中文声音一致。LXGW WenKai 作为回退前锋的审美差异不构成功能缺口（回退只渲染
主字体缺字形的字符）。

### 定谳 3（施工点，核实报告已定位）：fonts.ts 两条路径都要补

1. `ensureCJKFallback`（约 :611-617）：进 `ensureFallbackFamilies` 之前，先尝试
   `loadFont('Alibaba PuHuiTi', 'Regular')`（bundled 命中，离线可用），成功且未在
   `cjkFallbackFamilies` 则 unshift 到最前。幂等：既有 `cjkFallbackFamilies.length > 0`
   快路径与 `cjkFallbackPromise` 去重保持。
2. `ensureFallbackPack` 带 characters 的直调路径（约 :646-650，绕过 ensureCJKFallback）：
   同样保证 bundled PuHuiTi 在 targetFamilies 最前（复用同一内部辅助，不双写逻辑）。
3. 远端 `CJK_GOOGLE_FONTS` 回退保持末位兜底不动；本地系统字体探测段不动（授权后
   仍优先？——否：bundled 前插的意义就是不依赖授权；bundled 命中后本地段仍可追加，
   顺序 = bundled PuHuiTi → 本地 → 远端，保持现有 local/remote 段相对序）。

### 定谳 4（测试钉扎）

在 tests/engine/text/fonts/ 既有 fallback 测试文件（worker 自定位，若无合适文件则新建
cjk-fallback.test.ts）钉：① bundled PuHuiTi 命中时位于 CJK 回退链首位；② bundled 加载
失败时链行为与现状一致（降级到本地/远端，不 throw）；③ 幂等（二次调用不重复 unshift）。
测试侧加载缝沿用该目录既有 mock 先例。

## §2 施工清单

1. packages/core/src/text/fonts.ts：定谳 3 两处 + 内部辅助（如需）。
2. 测试钉扎（定谳 4）。
3. `bunx oxfmt --write` 仅触及文件。

## §3 门禁与边界

- 受影响测试：tests/engine/text/fonts/ 目录整体（小目录，可全跑该目录）；
  其余测试不跑（owner 禁令）。
- 七门禁由主 agent 收口跑。
- zone 预判：packages/core/src/text/ 与 tests/engine/text/ 为 T39/T41 既有工作面，
  预期零新登记。
- 完工写 T84-self-check.md（对照本 plan 逐项 + 偏差记录）。不 git add/commit。
