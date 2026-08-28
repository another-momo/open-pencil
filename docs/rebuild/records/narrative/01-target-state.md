<!--
  写作纪律（改本文前必读）：
  - 本文是 01-target-state.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/01-target-state.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[01-target-state.md](../../01-target-state.md)（一一对应）
> **身份**：本档案只持有针对 01-target-state.md 的腐烂记录与核验记录。runtime选型相关决策归 `records/topics/agent-runtime.md` D9。

---

## 腐烂类（派生自 records/topics/docs-governance.md ROT-1~4）

## ROT-1 · 01 v1 能力地图按价值分层

- **派生自**：`records/topics/docs-governance.md` ROT-1
- **错误**：能力地图按价值分层，闭环只列 C 块
- **实况**：缺支撑底座 F0，闭环跑不起来
- **处置**：v2 已重构

## ROT-2 · 01 v1 C1 含「素材图理解（hash 缓存）」

- **派生自**：`records/topics/docs-governance.md` ROT-2
- **错误**：C1 含「素材图理解（hash 缓存）」
- **实况**：R2 实测全仓无代码，phantom
- **处置**：v2 移入不加清单 + D8

## ROT-3 · 01 v1 validate 列为「后续移植/已废弃旧物」

- **派生自**：`records/topics/docs-governance.md` ROT-3
- **错误**：validate 列为「后续移植/已废弃旧物」
- **实况**：R2 实测无此工具注册
- **处置**：v2 改 C3c 新建

## ROT-4 · 01 v1 生图历史列为「后续独立加法」

- **派生自**：`records/topics/docs-governance.md` ROT-4
- **错误**：生图历史列为「后续独立加法」
- **实况**：R2 实测已内置于 generate_image
- **处置**：v2 已修正

---

## 核验类

## R2 · 01 组件与闭环依赖

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent B
- **范围**：[01-target-state.md](../../01-target-state.md)
- **结论**：端到端 9 环依赖链还原；能力地图漏 10 项（生图独立凭证链、MCP 桥三进程、brand 后端服务、聊天凭证下发、session 零持久化真相、validate 不存在、素材理解 phantom、生图历史已内置、视觉回路双份、ChatPanel 在根目录）→ 01 已重构

---

## 修正-N · 01 §1 补 D23 口径（编辑器完整前端能力在孤岛内全量保留）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-23
- **依据**：owner 拍板 D23（[records/topics/agent-runtime.md](../topics/agent-runtime.md)）——针对「overlay 内为何只有编辑器底层」质询，明确「我从来没有想要丢掉这些能力」；01 层 0/层 1/层 2 未列编辑器 chrome 块系计划空白，非「不做」决策
- **内容**：§1 一句话定义补一句：编辑器完整前端能力（画布 + 面板 chrome）在孤岛内全量保留（引 D23）；chrome 移植属主线范围，parity 切换前完成，实施任务待登记（建议紧随 T18 后）
- **task 文档**：[tasks/T17-plan.md](../../tasks/T17-plan.md)（登记提交随 T17 收口后决策，无独立任务）
## 修正-N · 01 §2 F0.2/F0.3/F0.4/F0.7 地面依据列 post-merge 实况修正（T18 P4）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-23
- **依据**：T10 upstream 合并（79 commits/864 文件）后 F0 表地面依据列大面积腐烂——实测（ls/find/grep）：packages/agent、scripts/inline-prompts.ts、agent-vite-plugin.ts、http-agent-transport.ts、agent-transport.ts、marketing/settings.ts、image-gen/providers.ts、ImageGenKeysSection.vue、setImageGenCredentials、/v1/auth 全部消失；现存实况为 src/app/ai/chat/transports.ts 双路径（浏览器内 ToolLoopAgent + harness:pi sidecar）+ src/app/automation/bridge 11 项 + packages/mcp + src/components/chat/ChatInput|ChatMessage.vue + system-prompt.md 运行时 ?raw 直读
- **内容**：F0.2/F0.3/F0.4/F0.7 四行地面依据列就地重写为 post-merge 实况（均附 2026-08-23 核验命令）；F0.3 处置由「移植并统一」改为「重建」（无码可移）；F0.7 处置改为「已消除」（脆依赖随 T10 移除）；其余行不动
- **task 文档**：[tasks/T18-plan.md](../../tasks/T18-plan.md)

## 修正-N · 01 §2 F0 处置列刷新 + §6 决策表同步 + §3 验收口径标注 + §8 人日【假设】标注（2026-08-25 三方 review 整改）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-25
- **依据**：三方 review 发现——① §2 F0 表处置列停在 pre-T19 口径（重建/移植+复审/新建），与 T19-T25 落地实录脱节；② F0.4 行内 `[§2-D9 runtime 选型](#27-dsh-集成形态)` 锚点不存在（本文无 §2.7 节）；③ §6 表头「集中登记于 tracker.md §1 阶段门」系错误指针（tracker 已无决策日志）；④ §3 层 1 验收「16 个移植测试文件全绿」口径失效（`find tests/engine/rebuild -type f` 实测仅 1 文件，2026-08-25；16 文件宿主 tests/engine/tools/{marketing,image-gen} 随 T10 消失）；⑤ §8 人日数字（X 比 Y 多 12-13、比 pi 多 17-18）无工时验证依据
- **内容**：F0.1/F0.4→已建成（T19）、F0.2→已建成（T20）、F0.3①→已建成（T21）②→待建、F0.5→已建成（T22/T23）、F0.6→已建成（T24），每格附 task 指针；F0.4 断裂锚点改指 [03-phase-1-runtime.md §5 选型决策](../../03-phase-1-runtime.md)；§6 表头改指 records/topics/ 各档案 + 增「状态」「登记档案」两列（D2 已拍板 2026-08-20、D7 已拍板=D24、D3/D5 已事实落地待补签、D1/D4/D6/D8 保持 open）；§3 层 1 验收数字旁加【口径失效待重建】标注（不改验收语义本身，报送 owner）；§8 人日句尾加【假设】标注；头部时间刷新
- **task 文档**：无独立 task（review 整改轮，T26 由主 agent 收口时统一登记）

## 修正-N · 01 §3 层 1 验收口径重建 + §6 D3/D5 补签已拍板 + §7 parity 线同步（2026-08-25 决策批 #3/#13）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-25
- **依据**：owner 2026-08-25 对三方 review 整改 15 项决策批逐项拍板——#3 决策补签组（D3/D5 补签）、#13 层 1 验收口径重建（新口径 = 五环冒烟实证）；决策登记见 [records/topics/docs-governance.md](../topics/docs-governance.md) 决策批总登记条目
- **内容**：
  1. **§3 层 1 验收改写**：「闭环端到端真实跑通 + 16 个移植测试文件全绿 + CI 绿」→「C1a-C5a 五环各配一条端到端冒烟且全绿 + `smoke:pi` 批次全绿 + CI 绿」——删除【口径失效待重建】标注，改写为新口径 + 修订注记（原 16 文件口径宿主 packages/agent 与 tests/engine/tools/{marketing,image-gen} 随 T10 消失；smoke:pi 批次现状 59 断言 = t22 target 6 + t22 history 12 + t23 sessions 14 + t24 装配 27，`grep '"smoke:pi"' package.json` 2026-08-25 实测；五环冒烟随各环施工逐条补入）
  2. **§6 决策表**：D3 状态「已事实落地待补签」→「已拍板（2026-08-25 owner 补签：一文件多会话 + 族谱形态确认；落地 = T22/T23）」；D5 同理→「已拍板（2026-08-25 owner 补签：双模式保留；落地 = T24）」；表上方同步注记一并刷新
  3. **§7 parity 线**：括注内「16 个测试文件绿」同步为新口径（指向本文 §3）
  4. 头部时间字段刷新（核验人补 owner 拍板 D3/D5）
- **task 文档**：无独立 task（决策批文档面落地，T29 由主 agent 收口时统一登记）

## ROT-21 · 01 §3 修订注记 smoke:pi 断言数当日即腐（59→80）

- **类型**：腐烂记录
- **时间**：2026-08-25
- **错的内容**：§3 修订注记写「smoke:pi 批次现状 = t22 target 6 + t22 history 12 + t23 sessions 14 + t24 装配 27 共 59 断言」（T29 起稿时口径）
- **实况**：同日先收口的 T28 已把 smoke:pi 扩为五套件（纳入 t28/session-gc-smoke）且 t24 修复后计数 27→29——实际 80 断言（6+12+14+29+19，`grep '"smoke:pi"' package.json`，2026-08-25）。T29 verify 独立核验（V6 观察项）实锤偏差
- **处置**：01 §3 当场修正为 80 断言口径并注明来源（05 §4.2 腐烂即改）；教训——同日多任务并行时，先收口任务的产物会使后收口任务的起稿数字当日即腐，引用动态计数宜附核验命令（本条已附）
- **派生自**：T29-verify.md V6 观察项（2026-08-25）

## 修正-N · 结构重整（§2 推进规划新增 + 原三路线对比节迁 03 + 去补丁式备注 + F0.3② 归并层 1 C3a）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-25
- **依据**：D30（01 结构重整：phase 规划入 01 + 三路线对比节迁 03 + 去补丁，owner 2026-08-25）+ D32（F0.3② 生图独立凭证链归并层 1 C3a，owner 2026-08-25）；决策登记见 [records/topics/docs-governance.md](../topics/docs-governance.md)
- **内容**：
  1. **新增 §2 推进规划（Phase 划分）**：层=图纸轴（WHAT，§3-§5）vs Phase=施工轴（WHEN，tracker §1）显式入文——Phase 0/1 无对应层（准备工作），Phase 2=层 0、Phase 3=层 1、Phase 4=层 2，parity 切换=§8；验收 by phase，各 Phase 验收口径主场以指针列入表
  2. **原三路线对比节（旧 §8）删除**：五条机制（SessionFace 桥/双框架/白名单 11 个/preview 颠簸/孤岛化）迁入 [03-phase-1-runtime.md §4.4](../../03-phase-1-runtime.md)（选型论证属 03 地盘，D30）；原 §2-§7 重编号为 §3-§8
  3. **打补丁式备注清零**（按 05 §4「只保留当前态」纪律规范化）：头部 changelog 化时间字段纯化（状态：已核验 | 时间：2026-08-25）；§1 D23 元叙事（「拍板背景见…」）删；§4 层 1 验收修订注记压缩为事实行（「2026-08-25 owner 拍板口径，决策批 #13」+ smoke:pi 80 断言事实 + 原 16 文件口径废止注）；§6 决策表同步注记 blockquote 删、表头「状态（2026-08-25 同步）」→「状态」；D3/D5 单元格「已事实落地待补签」→「已拍板（owner，2026-08-25：…）」；§7 parity 自指改 §4
  4. **F0.3② 移出层 0 并入 C3a（D32）**：F0.3 更名「聊天凭证链」（原 ② 取消，不沿用 F0.3② 编号）；§2 Phase 2 行 F0.1-F0.7→F0.1-F0.6；§4 C3a 依赖列「F0.2 + F0.3②」→「F0.2 桥」；§3 导语补边界句「F0 是纯聊天地基」
  5. 头部状态字段刷新
- **事故备记**：本轮 edits 曾因主 agent 误执行 `git checkout -- docs/rebuild/`（回滚 oxfmt 白空间散弹）全量丢失一次，凭上下文内容全量重写恢复；教训——格式化命令必须用精确文件名单独跑，不用目录通配
- **task 文档**：[tasks/T30-plan.md](../../tasks/T30-plan.md)

## T37 修正-N（2026-08-28） · §7 决策表 D1/D4/D6/D8 四行翻「已拍板」

- **改动**：§7 待拍板决策表 D1 / D4 / D6 / D8 四行状态 open → 已拍板（owner，2026-08-28），口径摘要随行注明；头部时间字段 2026-08-25 → 2026-08-28
- **拍板内容**：D1 不设专门参考图/参考区机制（需要参考时由用户指定画布节点作为 ref）；D4 短期 localhost serve、中长期转 Electron、不考虑 Tauri；D6 S3 混合（CDN 按需子集 + bundled 兜底，O3 字重另议）；D8 素材图理解确认放弃
- **登记处**：[topics/brand-config.md](../topics/brand-config.md)（D1/D6）、[topics/agent-runtime.md](../topics/agent-runtime.md)（D4）、[topics/chat-ui.md](../topics/chat-ui.md)（D8）；同批新全局决策 D34-D37 见 [topics/ci-infra.md](../topics/ci-infra.md) 与 [topics/docs-governance.md](../topics/docs-governance.md)
- **task 文档**：[tasks/T37-plan.md](../../tasks/T37-plan.md)
