# tracker · 重建跟踪表（活文档）

> 每次工作状态变化都要更新本表。更新纪律见 05-process.md §4。
> 状态值：⬜未开始 / 🔄进行中 / ✅完成 / ❌阻塞 / 🪦放弃

## 1. 阶段门

| 阶段 | 出口标准（摘要） | 状态 | 完成日期 | 验收签字 |
|---|---|---|---|---|
| pre-0 文档集 | 文档核查 + review 修正完成（R1-R4） | ✅ | 2026-08-18 | 待 owner |
| Phase 0 机制+减法 | 02 §5 六条验收（实测结果已填） | ✅ | 2026-08-19 | 待 owner（远端 CI 验证后补签） |
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

> **已终结**（2026-08-19，Agent W 核查）：这批 WIP 已随旧分支 commit `3f925191`「fix(quality): clear CI quality job errors」提交并推送，14/14 文件逐一核对全部为 lint/类型等价清理，零行为变更意图。**无一需要移植、无一可上游化、无一应丢弃**——rebuild 侧要么已逐字节一致，要么本就不含被清理的模式。重建分支无需从这批 WIP 继承任何东西。

## 4b. 执行期遗留（Phase 0 → 后续阶段）

| 项 | 内容 | 归属阶段 |
|---|---|---|
| `acp:` provider 概念残留 | models/settings 层仍引用 `ACP_AGENTS`（core constants）；选 ACP 档案会优雅失败 | Phase 1 重分类 chat/providers 时清理 |
| `@agentclientprotocol/sdk` 依赖 | 被 `src/app/integrations/mcp/runtime.ts` + core constants 引用，未裁 | 同上 |
| LFS 自有托管 | fork GitHub LFS 预算超额（pull 被拒）；新增 LFS 文件（如普惠体）前必须解决，或走子集化进普通 git（D6 相关） | D6 决策时 |
| 远端 CI 验证 | ~~分支未推送~~ **已推送**（2026-08-19 实测 `ls-remote origin rebuild/v2` = 4a17fc77 与本地同步，tracking 已修正为 origin）。~~CI 全绿与否待确认~~ **CI 已全绿**（2026-08-19，run 32248474442，11/11 job success，5 轮修复史见 §5 CI-1~CI-5） | 已闭环 |
| knip/steiger/oxlint 死配置残留 | desktop/packages-docs 等 ignore 条目保留未清（无害，零补丁纪律）；另有 knip.json `ignoreWorkspaces` 含 `packages/acp`（从未存在过的路径，上游死配置） | 可不处理 |

## 4c. Phase 0 gate review 整改（2026-08-19，subagent A 轮机械审计）

check.ts 四处漏洞修复：①删除侧零校验（曾漏检 7 个 notifications locale json 的删除——已补登）→ D 状态必须登记 deletedPaths；②R/C/T/U 状态逃逸 → 重命名拆解为删+增，其他状态显式报错；③revoked 补丁仍白名单 → 过滤；④头注释死规则（pendingReclass 字节一致）删除，与 zones.json 口径对齐。探针测试验证：未登记删除被抓（exit 1）。文档侧：02 修正 7 处正文残留矛盾（B14 表）+ 2 处计数错（chat 6 vue、collab 13 文件）。

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
| P0-1 | 2026-08-19 | Phase 0 验收：构建/类型 | `build:packages` + `tsgo --noEmit` + `vue-tsc` ×2 | 全绿（含 AI SDK 7 合并后复跑） | 主 agent |
| P0-2 | 2026-08-19 | Phase 0 验收：zone check | `bun tools/zone-registry/src/check.ts` | clean：24 modified（全登记）/15 added/951 deleted（base 0332b062） | 主 agent |
| P0-3 | 2026-08-19 | Phase 0 验收：单测 | 可疑回归文件隔离跑（rebuild 8 文件 0 fail）+ 纯净基线对照（baseline worktree @15bd0ba1 同机跑，14 个环境性失败同源）+ 合并后定点 460 用例 | 无删除引入的回归；全量以 CI 为准（本机负载 flake 已登记 02 §0.7） | 主 agent |
| P0-4 | 2026-08-19 | Phase 0 验收：冒烟 | vite build ✅、preview 画矩形全链路 ✅（截图存档）、dev server 启动 ✅、console 零报错、i18n 缝测试 2/2 ✅ | 通过；另发现并清除本机旧 PWA Service Worker 幽灵（02 §0.8） | 主 agent |
| P0-5 | 2026-08-19 | 合并演习 | `git merge upstream/master`（15bd0ba1→0332b062，8 commits 含 AI SDK 7 #555） | 冲突 10 文件按 SOP 处理（删除区重删 / 配置类以 upstream 为基座重放）；新增 P24（notifications locale 裁剪）；i18n 缝避让至 src/app/i18n/fork/ | 主 agent |
| P0-6 | 2026-08-19 | WIP 审判 | Agent W 对 git status + 3f925191 全 hunk 通读 | WIP 已随 3f925191 终结，重建分支零继承（tracker §4） | subagent W |
| P0-7 | 2026-08-19 | LFS 现状 | `git lfs pull` 实测 | fork GitHub LFS 预算超额（拒绝）；上游网关匿名读可用；本分支 LFS 面仅 6 个测试 fixture；P21 撤销 | 主 agent |
| P0-8 | 2026-08-19 | Phase 0 gate review | subagent A 轮机械审计（zones.json 全项对账 + 02 全文矛盾扫描） | patches P1-P24 全部真实、deletedPaths 44 条全落实、ownedRoots 零例外；发现 check.ts 4 漏洞 + 02 正文 7 处残留矛盾 + 2 处计数错 → 全部整改（见 §4c）；fonts 测试复跑 77/0 绿；PWA 零残留实证 | subagent A |
| P0-9 | 2026-08-19 | autocrlf 治理 | `core.autocrlf=false`（仓库级）+ 双 worktree LF 归一化 | autocrlf 类幻影 M 根除；LFS 类幻影保留（纪律约束） | 主 agent |
| P0-10 | 2026-08-19 | 远端同步 | `git ls-remote origin rebuild/v2` | 远端 = 4a17fc77 = 本地 HEAD；tracking 已指向 origin | 主 agent |
| CI-1 | 2026-08-19 | CI run 32243617082 | gh run watch + --log-failed | 3 job 红：Repository hygiene（doc 链接校验，docs site 已删）、Component workshop（storybook build 挂：public/ 图标是指向已删 desktop/ 的悬空 symlink）、Code quality（format:check）→ 修法：P26 移除 check:docs 步骤、P27-P30 symlink 换真实 PNG | CI 守护 |
| CI-2 | 2026-08-19 | CI run 32244794271 | 同上 | 3 job 红：Repository hygiene（test:tools）、Component workshop（storybook 仍挂）、Code quality lint 10 错（#core/* alias、!==-1、complexity 25、空函数、promise executor return 等）→ 修法：bdb3a042 逐项清理 | CI 守护 |
| CI-3 | 2026-08-19 | CI run 32246179576 | 同上 | Code quality lint 余 1 错：i18n 缝测试 `no-promise-executor-return` → 修法：7b8ecab1 | CI 守护 |
| CI-4 | 2026-08-19 | CI run 32247060166 | 同上 | Code quality `check:arch`：steiger strict-tools-layout 拒 tools/zone-registry/check.ts（须落 tools/<domain>/src/**）→ 修法：3dcc4f2c 挪至 src/check.ts + 仓根解析改 ../../.. + 同步 package.json check:zones / zones.json $comment / 02 与 tracker 引用。无新补丁：挪动全程在 owned root 内，package.json 变更由既有 P17（scripts）覆盖 | CI 守护 |
| CI-5 | 2026-08-19 | CI run 32248474442 | gh run view --json jobs | **全绿**：11/11 job success（Repository hygiene / Code quality / Package integrity / Component workshop / Engine tests ×7） | CI 守护 |

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
| 2026-08-19 | 02 v2 | tauri 需 stub 壳 | Agent A 实测：静态 import 遍布 ~20 文件，保持纯净 + 保留依赖即可 | 02 §0.1 已修正 |
| 2026-08-19 | 02 v2 | .lfsconfig 改指自有 LFS + CI 补 7 处 lfs | 实测：自有 LFS 超额、上游网关匿名可读、剩余 workflow 不需要补 | 02 §0.2/0.3 已修正，P21 撤销 |
| 2026-08-19 | 02 v2 | i18n 缝落位 src/app/i18n/ 根 | 上游 #557 已占用该目录（notifications/），缝避让至 fork/ 子目录 | 02 §0.4 已修正 |
| （后续发现逐行登记） | | | | |
