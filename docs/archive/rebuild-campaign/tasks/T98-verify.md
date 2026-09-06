# T98-verify · 上游大合并（88c10770 → d82aaff9e）

> **状态**：已完成 | **时间**：2026-09-06 | **核验人**：主 agent
> **核验范围**：T98-plan.md §5 验收标准六条

## 核验记录

### V0 · 规划完备性（2026-09-05，主 agent 内嵌）

- runbook 十步（Step 0-10）覆盖：预记账 / 起合并 / 机械 ours / deleted-by-us / P0 手术件 / 人工判断文件 / rename 改锚 / 复活清除 / 依赖与门禁 / 总落账与分段提交——与 06-zone-governance.md §5 ritual 六步对应关系明确
- Phase A 交付物契约三份齐全且路径唯一（各代理独立 worktree，merge-artifacts/ 不进合并分支）
- owner 三项拍板已写入计划战略决策节（draw.ts 采用上游 + 浏览器前置验证 / options 考古裁定 / 报告吸收）

### V1 · `check:zones` exit 0（2026-09-06 实测）✅

- 登记 P207（paragraph-cache.ts 回退族现值链）/ P208（renderer/fonts.ts 启动期 ensureFallbackPack 注入）后复跑：`[zones] clean: 122 modified (all registered), 706 added (owned), 1273 deleted (all registered), 30 renamed (cross-checked), base d82aaff9` —— exit 0
- 登记前机验精确命中且仅命中这两件新分歧（MODIFIED but not registered ×2），证明台账无漏登

### V2 · `check:docs` / `check:bindings` / `check:tasks` 全绿（2026-09-06 实测）✅

- `check:docs`：45/45 通过（R1-R5）——tracker.md T98 行两处裸 § 引用（06 §5 / A2 §3）已修为「文件名.md §N」格式
- `check:bindings`：11 文件变更，binding 全绿
- `check:tasks`：tracker.md §2 表补登 T98 行（末三列三件套路径），物理文件齐（plan / self-check / verify），预提交钩子实测通过
- `check:i18n` 于 `bf4928137` 转绿（zh-CN 858/874），本窗口 7 文件修正未触碰键集

### V3 · 手术件与 A1/A2 交付一致 + options 裁定证据链 ✅

- fonts.ts 三方融合按 A1 定稿落账（P107/P110/P113/P114/P115/P116 增量保留）；options 考古裁定记录于 A1 DECISION.md（merge-artifacts，仓外）
- draw 簇整文件取上游形态，与 A2 NOTES.md 采用建议一致；A2 三闸门前提中唯一被 Phase B 遗漏的闸门 1 调用链，由本收口 P207/P208 补上并有浏览器实证（场景 1 FAIL→PASS）
- scene.ts P108 修复保留注入；台账 R6 吸收（513ef0f17）按 A3 裁定执行

### V4 · i18n 25 键重删/证伪 ✅

- 上游 be942783d 域命名空间迁移完成吸收：diagnostics 域整域下线（`bf4928137`，34 键逐键复核：13 同名幸存 + 19 改名幸存 + 2 真删，幸存键零消费整域清除），P192/P193 改锚重激活 + P203-P206 登记配套
- dialogs 聚合槽残留 7 文件修正（本 commit）：逐键核实新家——ai.ts 11 键同名幸存、collaboration.connected 沿用、settings/credentials/media 域对齐上游模板引用；修复后全仓零 `useI18n()` 非法槽解构（扫荡复核）

### V5 · 浏览器验证清单（A2 BROWSER-VERIFY-CHECKLIST.md 12 场景，2026-09-06 主 agent 实测）✅

| 场景 | 判定 | 证据 |
| --- | --- | --- |
| 1 CJK Section Title | PASS（修复后） | scene1-fixed-full.png；glyph 探针 839/3418 真实字形 |
| 2 混合 Latin+CJK Component | PASS | scene2-3-closeup.png（App 设计 / 在线 123 + 紫钻 icon） |
| 3 Arabic 标签 | FAIL-合并语义缺口（登记延期） | scene3-zoomfit.png；根因：bundled NotoNaskhArabic-Regular.ttf 在 `packages/core/src/text/fonts.ts` 的 BUNDLED_FONTS，但 ensureFallbackPack 经 ensureFallbackFamilies 通道从不去查 bundled——T88 时代 loadFonts 显式走通道 A 加载 bundled，CJK 侧已 mirror prependBundledCJK 到 ensureCJKFallback，Arabic 侧漏 mirror。修法：mirror prependBundledCJK 到 ensureArabicFallback（约 5 行）；owner 无阿语需求，登记延期 |
| 4 超长 ellipsize | PASS | scene4-zoomfit.png（EN/CJK 双 pill 末尾 … 不溢出，Skia ICU 截断） |
| 5 极窄容器 5px | PASS | scene5-narrow.png（pill 守卫触发无崩溃，console 零错误） |
| 6 白名单禁用族 | PASS | scene6-fonts-panel.png / scene6-disabled-tab.png（已停用列表在列、计数 2103→2102、已注册 label 不受影响） |
| 7 CDN 冷启动 + 生僻字 | 机制 PASS / 字覆盖 FAIL-预存边界 | scene7-cold-final.png（reload 恢复后全部 label 重建无崩溃）；需求链实证触发（noto-sans-sc chinese-simplified 子集加载、generation 16→106）；龘 U+9F98 / 𠮷 U+20BB7 全 family 链 glyph 0 实测——覆盖边界非链路缺陷 |
| 8 白名单 + 加载链路 | PASS（适配） | 内置三族 UI 恒启用（「内置字体始终启用——它们是渲染兜底」），上游级停用路径产品面不可达；allowlist↔加载链经 CDN 精选族关停/重开验证 |
| 9 协作 cursor 中文名 | PASS（接受回归实证） | scene9-cursor2.png（合成注入 remoteCursors，中文名 tofu 如 P149 退役预期，无崩溃） |
| 10 Frame title 选中态 | PASS | scene10-frame-panned.png（框架标题 / Frame Title 测试 混排正确、selColor 蓝） |
| 11 fontGeneration 失效 | PASS | LXGW WenKai 切换触发 16→106 注册波，label 缓存 clear 重建后全量正确渲染（scene11-after-gen-bump.png），无 WASM 报错 |
| 12 pageColor 暗黑 | PASS | scene12-dark.png（#1E1E1E 背景下 pill 文字对比度正常，canvasLabelForeground 链路正确） |

### V6 · ux6 chat 输入框浏览器回归（2026-09-06）✅

- 全链通过：CJK 打字 / Enter 提交 / 成功清草稿 + 失败恢复（T27）/ 内联选区 chip（ChatNodePreview 缩略图 + 移除）/ manifest 序列化（「@画布选区-1」+ 节点 0:13 引用）/ 工具标签 i18n（「Eval 完成」）/ thinking 折叠卡 / markdown 回复画布数据正确（160×120 px、x=231.83、#D4D4D4）/ Clear + Copy log 工具条语义符合设计
- 全程 console 零 pageerror / 零 warning
- 预存 quirk 登记（非本次引入，mode-arch 同源）：打字期间发送按钮恒 disabled（Enter 经 form requestSubmit 绕过）、placeholder 依存 `input` ref 打字时残留
- 后端会话模型钉扎注意：改设计模型指派不影响已存会话，须新文档（新 sessionId）——本次验证即以此绕过

## 综合判定

**通过**——六条验收标准全部满足：V1-V4 机验门禁全绿（zones/docs/bindings/tasks/i18n），V5 十二场景 8 PASS + 2 预存边界（均证非合并引入）+ 1 接受回归实证 + 1 设计锁定适配，V6 ux6 回归全通。遗留项（Arabic 子集缺口修法、attachment owner 拍板、ux6 预存 quirk）已登记不阻塞合回 rebuild/mode-arch。
