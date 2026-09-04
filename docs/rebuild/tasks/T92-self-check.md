# T92-self-check · look-tool UI 工具卡片 base64 裁剪 + 模型通道占位符 omit

> **时间**：2026-09-04
> **施工**：subagent；验收 commit 留主 agent

## 1. 改动对照（plan → 实际）

| 计划项 | 实测 | 通过 |
| --- | --- | --- |
| `src/components/chat/tool-output.ts` 新建 displayToolOutput | 已建；errorText / error / media 裁剪 / 默认 JSON 四路径 | ✅ |
| ChatMessage.vue 模板三元换 displayToolOutput(part) | 已换；本地 hasErrorOutput 已删（grep 零残留引用） | ✅ |
| media-output.ts 增 sanitizeMediaToolOutputForModel（完全 omit） | 已加；既有 sanitizeMediaToolOutput 语义未动 | ✅ |
| tools.ts content[1].text 换 ForModel 变体 | 已换；details: result 不动 | ✅ |
| 新测试 5 例 | tool-output-display.test.ts 5 pass / 0 fail / 14 expect | ✅ |
| zones 零新登记 | check:zones clean（两新文件均在 ownedRoot：src/components/chat/ + tests/engine/rebuild/） | ✅ |

## 2. 门禁实跑

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 新测试 | `bun test tests/engine/rebuild/marketing/tool-output-display.test.ts` | 5 pass / 0 fail |
| 套件回归 | `bun test tests/engine/rebuild/marketing/ tests/engine/app/chat/` | 242 pass / 0 fail（15 文件） |
| look/pi-backend 回归 | `bun test tests/engine/rebuild/marketing/look.test.ts tests/engine/rebuild/pi-backend/` | 112 pass / 0 fail（10 文件） |
| 类型 | `bunx tsgo --noEmit` | exit 0 |
| Vue 类型 | `bunx vue-tsc --noEmit -p tsconfig.json` | exit 0 |
| 格式化 | `bunx oxfmt --check .oxfmtrc.json <5 触碰文件>` | All matched files use the correct format |
| lint | `bunx oxlint -c oxlint.json <5 触碰文件>` | 0 warnings / 0 errors |
| zones | `bun tools/zone-registry/src/check.ts` | clean（0 违规） |

> lint 首跑命中 1 错（自定义规则 no-broad-unknown-type-assertions 禁 `as Record<string, unknown>`）——测试改用具名 `ParsedDisplay` 接口后清零。

## 3. 语义核对

- **UI 通道双占位形态并存不冲突**：mapping 层 file chunk 路径的 tool-output-available 仍带 `[inlined as file part, N chars]`（sanitizeMediaToolOutput，look.test.ts:561 钉扎未动）；displayToolOutput 的 `[omitted N chars]` 只兜住带完整 base64 的 part.output 形态（对齐预研 §2 老分支 displayOutput 文案）。
- **模型通道 omit 安全**：模型图像走 content[0].image（真模态），content[1].text 仅元数据副本；grep 确认无测试/代码断言 content[1].text 的占位符。
- **isMediaToolOutput 误裁防护**：非 media 输出（无 base64+mimeType 双 string）走原样 JSON.stringify——测试例 2 钉扎。
- **details 完整 base64 保留**：有意为之（mapping 层 mediaToolOutputChunks 兜底脱敏），不在本任务范围。

## 4. 遗留

- 浏览器端真值（展开 look 工具卡片目视确认）待主 agent / owner 验收时实测；单元层已覆盖序列化路径。
- 未 git add/commit——留主 agent 验收 commit。
