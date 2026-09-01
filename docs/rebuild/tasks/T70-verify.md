# T70 核验 · 画布选区采集（内联 token）

> 日期：2026-09-01。独立核验 subagent（只读，未改动任何实现文件；git 仅读操作）。
> 材料：T70-plan.md（含 owner 二次裁定：内联 token 非 chip 栏）、T70-self-check.md。
> 实现：selection-capture.ts（新）/ ChatInput.vue（改）/ i18n 双 locale / selection-capture.test.ts（新，25 例）/ longform.md 通用纪律第 4 则。

## 逐项核验

| 项                     | 结论 | 证据                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 形态合规            | PASS | ChatInput.vue 无选区 chip 列表渲染：token 仅以 backdropSegments 的 `<span>` 背景块形式出现在 overlay backdrop 内（模板 L290-297），glyph 由上层 textarea v-model 文本提供；文件内 "chip" 仅指 ChatModeChips（mode/profile，T61 面）与 chips 域文案键，与选区 token 无关。占位串 `「@画布选区-N」` 在文本模型内（selection-capture.ts L36-47），符合 owner 二次裁定。 |
| V2 采集语义            | PASS | captureSelectionFromStore 读 `store.state.selectedIds` + `store.state.currentPageId`（selection-capture.ts L100-109，同 findSelectionImageNodes 读图面）；空选区/全失效 → null（L95）→ ChatInput 按钮 1.6s 文案反馈（L64-73、L128-133）不产生 token；insertTokenAtCursor 聚焦时插光标处、无焦点追加文末（L103-122）。                                                |
| V3 overlay 高亮        | PASS | backdrop 与 textarea 同 `px-3 pt-2.5 pb-1 text-xs leading-relaxed` + `whitespace-pre-wrap break-words`（模板 L287 vs L307），尾部 ZWSP 对齐末尾换行高度（L92-93）；`@scroll="syncBackdropScroll"` 单向同步 scrollTop（L97-101、L309）。                                                                                                                              |
| V4 原子删除            | PASS | atomicTokenDeletionRange：backward 用 `TOKEN$` 锚定光标前串尾（L195-197）、forward 用 `^TOKEN` 锚定光标后串首（L199-201），各给整段区间；光标落中间/方向反/文档边界 → null（测试 L157-168 钉扎）。IME 合成中（event.isComposing）与有选区时不拦（ChatInput.vue L144）。                                                                                              |
| V5 清单契约            | PASS | serializeSelectionManifest 输出 `\n\n[画布选区]\n` + 每行 `@画布选区-N = 节点 <id>「名称」(<类型>)`（L251），多节点 `+` 连接（L258），已删节点 `节点 <id>「快照名」(已删除)`（L253-256），无登记 `@画布选区-N = 未采集的引用`（L243）。测试 L217-232 两 token 验收句「将@画布选区-1变成@画布选区-2的风格」两行逐字 `toBe` 钉扎；行序 = 首现序（L273-289）。          |
| V6 T27 回填            | PASS | handleSubmit 快照先行（L204）→ emit → 清文本 + resetSelectionDraftState（L206-207）；restoreDraft 剥尾（stripSelectionManifest）+ 快照一次性恢复（L214-221，消费后置 null 防串稿）；clearDraft 全清序号归 1（L224-228）。快照-恢复往返与深拷贝独立性测试钉扎（test L330-362）。                                                                                      |
| V7 longform 第 4 则    | PASS | git diff 确认单行改写：旧「消息尾部 `[画布选区]` 块 = 显式引用」纯纸面措辞 → 新「用户经输入框『采集画布选区』按钮采集为 `@画布选区-N` 内联引用（T70）；尾部块是该引用的清单」，含「（已删除）」与「未采集的引用」两标注语义，与新机制一致，无残留矛盾。                                                                                                              |
| V8 门禁复跑（unpiped） | PASS | `bun test ./tests/engine/rebuild` → 402 pass / 0 fail / 33 文件，exit 0；`bun run lint` exit 0（0 errors；warnings 为 packages/core variants 等既有 max-lines，与 T70 文件无关）；`bun run typecheck` exit 0；`bun run format:check` exit 0；`bun run check:zones` exit 0（clean，0 违规）。                                                                         |
| V9 领土合规            | PASS | git status --porcelain：`M` longform.md / en.ts / zh-cn.ts / ChatInput.vue；`??` T70-self-check.md / selection-capture.ts / tests/engine/rebuild/chat/——全部 ∈ 允许集，无越界文件。                                                                                                                                                                                  |

## 补充观察（不阻塞）

- lint 两段输出合计 16 warnings / 0 errors，抽查均为既有文件 max-lines（如 packages/core/src/editor/components/variants/index.ts 704 行），T70 五文件零警告。
- 自检申报与实际全对得上（路线 A 未升级、25 用例、偏差 5 条均能在码中找到对应注释）。

## 总结论

**PASS（9/9）**——形态、语义、契约、门禁、领土全部合规，与 T70-plan（含 owner 二次裁定）及 T70-self-check 申报一致。
