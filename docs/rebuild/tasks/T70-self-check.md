# T70 自检 · 画布选区采集（内联 token）

> 日期：2026-09-01。实施 = subagent（路线 A 无升级），longform 同步 = 主 agent。

## 1. 交付（对照 T70-plan §2，含 owner 二次裁定的内联 token 形态）

- `src/components/chat/selection-capture.ts`（新，纯函数面）：占位串契约 `「@画布选区-N」`、captureSelection（读 `state.selectedIds` + graph，同 findSelectionImageNodes 读图面）、scanSelectionTokens、atomicTokenDeletionRange、serializeSelectionManifest（`[画布选区]` 清单；多节点 `+` 连接；已删节点标 `(已删除)` 回落快照名；无登记标「未采集的引用」）、stripSelectionManifest（T27 回填剥尾）、草稿状态四件套（序号从 1 递增、reset 归 1、深拷贝快照）。
- `ChatInput.vue`：① InputGroup attachment 槽「采集画布选区」按钮（@mousedown.prevent 保焦点；插光标处；空选区 → 按钮文案反馈 1.6s）；② overlay backdrop 高亮层（同字号/行高/内边距 + pre-wrap，透明字形 + token 段高亮，尾部 ZWSP 对齐滚动，@scroll 单向同步）；③ keydown 原子删除拦截（IME 合成中/有选区不拦）；④ submit 实扫占位串拼清单后缀，快照先行；⑤ restoreDraft 剥尾 + 登记表恢复，clearDraft 全清。
- i18n：chips 域两键双语（chipsCaptureSelection / chipsCaptureEmpty），跟随 ChatInput 现有注入惯例。
- `tests/engine/rebuild/chat/selection-capture.test.ts`（新）：25 用例全覆盖验收清单（含「将@画布选区-1变成@画布选区-2的风格」两行清单逐字钉扎 + store 端到端）。
- `longform.md` 通用纪律第 4 则同步（主 agent）：`[画布选区]` 块机制从纸面协议改为「采集按钮产生」+「已删除/未采集的引用」两标注语义——T68 落地后执行，符合 plan §3 时序约束。

## 2. 路线裁决

实际走**路线 A**（overlay 高亮 textarea），未受阻，未升级 B。已知残余（代码注释在案）：IME 合成中未上屏文本不进 backdrop（compositionend 自愈）；极端长词软折行理论微差。

## 3. 门禁（unpiped）

- subagent 面：`bun test ./tests/engine/rebuild` exit 0（402 pass / 0 fail，33 文件）/ lint 0 / typecheck 0 / format 0。
- 主 agent 集成面（含 longform 同步行）：test 0 / format 0 / zones 0 / typecheck 0 / lint 0。
- zones：subagent 回报时唯一违规 = 主 agent 的 T72 manifest.ts 未登记项（时已补 P140），T70 自身 5 文件全在 ownedRoots 零登记。

## 4. 偏差（subagent 汇报收录）

1. 空选区提示走 plan 明许的兜底分支（actionToast 桌面端无渲染面 → 按钮短暂文案反馈）。
2. 已删节点清单行格式具体化为 `节点 <id>「快照名」(已删除)`，测试钉扎。
3. 草稿状态抽纯函数四件套（仓内无 Vue 组件测试设施）。
4. restoreDraft 快照只消费一次（恢复后置 null，防串稿）。
5. plan §3 longform 同步由主 agent 执行（subagent 领土禁令）。
