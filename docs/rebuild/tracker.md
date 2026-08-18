# tracker · 重建跟踪表（活文档）

> 每次工作状态变化都要更新本表。更新纪律见 05-process.md §4。
> 状态值：⬜未开始 / 🔄进行中 / ✅完成 / ❌阻塞 / 🪦放弃

## 1. 阶段门

| 阶段 | 出口标准（摘要） | 状态 | 完成日期 | 验收签字 |
|---|---|---|---|---|
| pre-0 文档集 | 文档核查 + review 修正完成（R1-R4） | ✅ | 2026-08-18 | 待 owner |
| Phase 0 机制+减法 | 02 §5 六条验收 | ⬜ | — | — |
| Phase 1 runtime spike | 03 Q0-Q3 有代码答案 + 能力契约测试绿 | ⬜ | — | — |
| Phase 2 F0 地基切片 | 01 §2 hello-tool 验收 | ⬜ | — | — |
| Phase 3 最小价值闭环 | 01 §3 层 1 验收（端到端 + 16 测试文件绿 + CI 绿） | ⬜ | — | — |
| Phase 4 增强补齐 | 01 §4 层 2 逐块进 | ⬜ | — | — |
| parity 切换 | 01 §7，owner 决定 | ⬜ | — | — |

## 2. 决策日志

| # | 问题 | 选项 | 状态 | 拍板 | 日期 | 理由/影响 |
|---|---|---|---|---|---|---|
| D1 | 参考图机制形态 | a) 文档内参考区 page b) 收编 brand config | open | — | — | C2/C3 边界 |
| D2 | vision 通道 B 去留 | a) 保留独立凭证 b) 并入统一 provider c) 砍 | open | — | — | R2 实测：双份视觉回路+独立凭证是复杂度主源 |
| D3 | session 模型 | a) 一文件一 session b) 一文件多 session | open | — | — | F0.5 + C5b |
| D4 | 产品形态 | localhost serve 单用户是否定论 | open | — | — | B4 + cli 处置；建议 Phase 0 中期前定 |
| D5 | chatMode（UI/营销双模式） | 保留双模式 / 只做营销 | open | — | — | C5 与 prompt 装配范围 |
| D6 | 中文字体策略 | 62MB 普惠体全量 / 子集化 / 系统字体 | open | — | — | E1 |
| D7 | runtime 选型 | pi sdk / dsh | open（Phase 1 spike 后定） | — | — | 03 §3：对立面是「pi sdk 直接驱动 vs Cordis+pi-ai」 |
| D8 | 「素材图理解」是否新建立项 | 新建 / 确认放弃 | open | — | — | R2 实测：旧 changelog 声称的能力全仓无代码 |

## 3. 任务表（能力块 = 1 PR + 验收测试 + 本表一行）

| 块 | 内容 | 验收 | 状态 | PR |
|---|---|---|---|---|
| — | （Phase 0 开工后逐行登记） | — | — | — |

## 4. 旧分支 WIP 审判清单

> 来源：2026-08-18 实测 `git status`（feature/agent-backend 未提交修改）。性命：移植为补丁 / 可上游化 / 丢弃。

| 文件 | 改动内容（待查） | 性命 | 状态 |
|---|---|---|---|
| `packages/core/src/canvas/boolean.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/canvas/fills.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/canvas/scene.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/canvas/shadows.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/canvas/strokes.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/canvas/text/index.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/figma-api/accessors/visual.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/rpc/analyze-commands.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/tools/describe/issues.ts` | 待查 | 待定 | ⬜ |
| `packages/core/src/tools/marketing/setup.ts` | 待查 | 待定 | ⬜ |
| `src/app/ai/chat/transports.ts` | 待查 | 待定 | ⬜ |
| `src/components/chat/ChatInput.vue` | 待查 | 待定 | ⬜ |
| `src/components/chat/ProfileGalleryDialog.vue` | 待查 | 待定 | ⬜ |
| `tests/engine/agent/elision.test.ts` | 待查 | 待定 | ⬜ |
| （`git status` 完整输出见核验日志 V1；可能还有未列出项，审判时重新取） | | | |

## 5. 核验日志

| 编号 | 日期 | 对象 | 方法 | 结论 | 核查人 |
|---|---|---|---|---|---|
| V1 | 2026-08-18 | 分叉规模 | `git diff $(merge-base)..HEAD --shortstat` 等 | 230 前/73 后（含合并口径），229A/118M/0D，+41,177/−1,114（测量点 a1c33881） | 主 agent |
| V2 | 2026-08-18 | 营销+生图测试 | `bun test ./tests/engine/tools/marketing ./tests/engine/tools/image-gen` | 16 文件全绿，运行时报告 224 通过 | 主 agent |
| V3 | 2026-08-18 | 旧文档腐烂 | `ls`/`git diff`/`find` | 5 处实锤，见 00 §5 | 主 agent |
| R1 | 2026-08-18 | 00 事实清单 | subagent 对账 | 大体成立；修正：缝 +75/−4 与 +61/−1（136 行新增）、8 个 profile、双份 prompt 副本、落后数 73、agent 42 文件含生成物、core ai-adapter 也耦合 'ai'、elision/media-rewriter 双份镜像、routes 五端点 + SQLite brand 覆盖层 | subagent A |
| R2 | 2026-08-18 | 01 组件与闭环依赖 | subagent 对账 | 端到端 9 环依赖链还原；能力地图漏 10 项（生图独立凭证链、MCP 桥三进程、brand 后端服务、聊天凭证下发、session 零持久化真相、validate 不存在、素材理解 phantom、生图历史已内置、视觉回路双份、ChatPanel 在根目录）→ 01 已重构 | subagent B |
| R3 | 2026-08-18 | 02 上游删除目标 | subagent 对账 | 删除目标均在；修正：locale 删 7 留 zh-CN、mergeLocaleMessage 虚构（实为 nanostores i18n）、IS_TAURI 37 处/16 文件、EditorView 切断点 5+、配置连带面（package.json/knip/steiger/oxlint）、browser-bridge 冲突、CI lfs 需补 7 处、registry.ts 9 行组合文件 + registerComponentCatalog 先例 | subagent C |
| R4 | 2026-08-18 | 03 前端契约 + dsh 实况 | subagent 对账 + 读 dsh 源码 | 前端 = @ai-sdk/vue Chat 类 + 自写 UIMessage stream v1 解析；dsh 实测：Cordis 插件、session 事件溯源、compaction 可替换 seam、ToolResultBlock 递归含 ImageBlock（适配器当前 text-only）、stdio 子进程嵌入、多 provider 实为 pi-ai@0.82.1；pi sdk 本地不可查 → 降级【假设】 | subagent D |

## 6. 文档腐烂记录

| 日期 | 文档 | 错误内容 | 实况 | 处置 |
|---|---|---|---|---|
| 2026-08-18 | 01-target-state.md v1 | 能力地图按价值分层，闭环只列 C 块 | 缺支撑底座 F0，闭环跑不起来（owner 初审发现） | v2 已重构 |
| 2026-08-18 | 01 v1 | C1 含「素材图理解（hash 缓存）」 | R2 实测全仓无代码，phantom | v2 移入不加清单 + D8 |
| 2026-08-18 | 01 v1 | validate 列为「后续移植/已废弃旧物」 | R2 实测无此工具注册 | v2 改 C3c 新建 |
| 2026-08-18 | 01 v1 | 生图历史列为「后续独立加法」 | R2 实测已内置于 generate_image | v2 已修正 |
| 2026-08-18 | 02 v1 | locale 删 8 收 zh-cn+en | R3：上游 9 locale = en + 8 翻译（含 zh-CN），应删 7 | v2 已修正 |
| 2026-08-18 | 02 v1 | i18n 缝用 mergeLocaleMessage | R3：API 虚构，上游为 @nanostores/i18n | v2 已修正（缝按 nanostores 重新设计） |
| 2026-08-18 | 02 v1 | IS_TAURI「18 处动态 import」 | R3：37 处/16 文件、动态 import 29 处 | v2 已修正 |
| 2026-08-18 | 02 v1 | /share/:id、EditorView 切断 1 处、presence 1-3 处 | R3：:roomId；EditorView 单文件 5+ 处 | v2 已修正 |
| 2026-08-18 | 03 v1 | pi sdk「有 AI SDK harness 适配器」作基线事实 | R4：本地无包无法证实 | v2 降级【假设】 |
| 2026-08-18 | 00 v1 | 缝「+79/+62、~140 纯追加」 | R1：+75/−4、+61/−1，136 行新增 | v2 已修正 |
| 2026-08-18 | 00 v1 | 分叉「72 落后」 | R1：73（含合并口径） | v2 已修正 |
| （后续发现逐行登记） | | | | |
