# 营销工作台规划：文档地图与状态面板

> 最后更新 2026-08-02（文档重排：拆 architecture/ + tasks/ + history/ 三层）。本文档是所有规划文档的**唯一状态来源**。规则：
>
> 1. **状态只在本文件维护**——设计文档不写任务进度，只描述"当前正确的设计"；
> 2. 知识库（`knowledge/`）只追加不修改；
> 3. 评审记录（`../review/`）落档后不再改动，结论通过修订设计文档生效；
> 4. **设计文档位于 `architecture/`**；**任务记录位于 `tasks/`**；**从设计文档切出的实施/时间线/误诊记录位于 `history/`**。

## 目录结构

```
plans/
├── README.md                       # 本文件
├── 00-overview.md                  # 业务总览：产品定位 + 三层架构
│
├── architecture/                   # 设计文档（描述"当前正确的设计"）
│   ├── l1-image-gen.md
│   ├── l2-agent-mode.md
│   ├── l2-ai-undo-snapshot.md
│   ├── l2-context-engineering.md
│   ├── l2-marketing-font-puhuiti.md
│   ├── l2-resource-library.md
│   ├── l2-visual-loop.md
│   ├── fork-divergence.md
│   └── l3-workbench.md
│
├── tasks/                          # 实施任务记录（带 Step/验收/时间线）
│   └── l1-image-gen-optimize.md    # 实施步骤骨架 + 验证/回滚指针
│
├── history/                        # 从设计文档切出的实施/时间线/误诊记录
│   ├── l1-image-gen-history.md
│   ├── l2-agent-mode-history.md
│   ├── l2-ai-undo-snapshot-history.md
│   ├── l2-context-engineering-history.md
│   ├── l2-marketing-font-puhuiti-history.md
│   ├── l2-resource-library-history.md
│   ├── l2-visual-loop-history.md
│   └── l3-workbench-history.md
│
├── knowledge/                      # 只追加不改
│   ├── error-catalog.md
│   └── methodology.md              # 8 节：含 §8 测试陷阱（Playwright/Figma API 双接口字段名混淆）
│
└── archive/                        # 已归档（缩简后 65 行）
    └── marketing-mode-switch-plan.md
```

> `../library-format.md` 位置不变（.fig 格式契约，跨进程引用）。`../review/` 9 份评审见其 `README.md` 索引。

## 文档地图

| 文档 | 类别 | 内容 | 保质期 |
|---|---|---|---|
| `00-overview.md` | 总览 | 产品定位、三层架构、落地顺序、源码参考 | 易变，随进展更新 |
| `../library-format.md` | 规范 | Library .fig 格式规范：四个 zone 的 KV/Markdown 语法、warnings 总表、作者扩展示例 | 半持久 |
| `architecture/l2-agent-mode.md` | 设计 | L2 主设计：理念、工作流、素材类型、资源体系、校验 | 半持久 |
| `architecture/l2-context-engineering.md` | 设计 | L2 上下文工程：media elision、跨 session 恢复、类型关键词下沉 | 半持久 |
| `architecture/l2-resource-library.md` | 设计 | L2 资源库：type/profile/reference 三关切解耦 + Library .fig 单一来源 | 半持久 |
| `architecture/l2-visual-loop.md` | 设计 | L2 视觉回路：多模态看图、look 工具、双通道架构 | 半持久 |
| `architecture/l3-workbench.md` | 设计 | L3 工作台交互：三类信息模型、需求单、类型显性化、制作清单 | 半持久 |
| `architecture/l1-image-gen.md` | 设计 | L1 生图工具：references 解耦、尺寸规范化、超时/错误处理、`asImage: true` 渲染 | 半持久 |
| `architecture/l2-ai-undo-snapshot.md` | 设计 | L2 AI undo 合并：per-burst coalesceKey（拆分 AI undo 栈 + 50x 内存节省） | 半持久 |
| `architecture/l2-marketing-font-puhuiti.md` | 设计 | L2 营销字体：PuHuiTi 9 字重 + BUNDLED_FONTS + FONT_WEIGHT_NAMES 修复 | 半持久 |
| `architecture/fork-divergence.md` | 治理 | Fork 与 upstream 差异全景：处置（保留/丢弃/重构）、冗余接受标准、合并 SOP | 每次合并后刷新 |
| `tasks/l1-image-gen-optimize.md` | 任务 | L1 实施步骤骨架 + 验证/回滚指针（设计见 `architecture/l1-image-gen.md`） | 半持久 |
| `tasks/look-tool-fixes.md` | 任务 | look 工具修复与优化：素材缓存删减、凭证链路正确性修复 + 体验增强，三阶段实施（设计见 `architecture/l2-visual-loop.md`） | 半持久 |
| `history/<name>-history.md` | 历史 | 从对应设计/任务文档切出的实施记录、误诊修正、评审后续修正 | 档案（追加） |
| `knowledge/error-catalog.md` | 知识 | 冒烟测试错误目录（实测驱动迭代的核心资产，持续追加） | 只增不改 |
| `knowledge/methodology.md` | 知识 | 实测沉淀的方法论：注入可靠性排序、可判定性划分、测试陷阱 | 只增不改 |
| `archive/marketing-mode-switch-plan.md` | 归档 | L2 Phase 0 模式切换设计决策（已实现，261→65 行缩简） | 档案 |

评审记录见 `../review/`。

## 模块状态

| 模块 | 状态 | 下一步 |
|---|---|---|
| L1 生图工具 | ✅ 优化已实施（2026-07-28）+ 评审后续批次已落地（2026-07-30） | 联调验证：场景验证表 7 场景（重点：编辑含目标自身、替换不带旧图、`asImage: true` 渲染参考）+ 冒烟 |
| L2 Phase 0 模式切换 | ✅ 完成 | —— |
| L2 Phase 1 核心链路 | ✅ 代码完成 | —— |
| L2 Phase 2 安全护栏 | ✅ 代码完成 | 护栏场景随第 4 轮回归验证 |
| L2 Phase 3 实测迭代 | 🔄 3 轮冒烟完成 | **第 4 轮回归**（用例见 `knowledge/error-catalog.md` §待验证场景） |
| L2 上下文工程（子规划） | ✅ 4 项任务全部实施（2026-07-28） | 冒烟回归：朋友圈/小红书/DSP 各一（类型推断准确率 + 单步输入峰值 <100K + 重开文档 validate 可用）；多设计同类型并存（制作清单）未支持，随 L3 启动再评估 |
| L2 AI undo coalesce（子规划） | ✅ 已实施（2026-07-28） | 随第 4 轮回归做冒烟验证：DevTools memory（1 次 burst 后 undo ≤ 200 KB）+ Ctrl+Z 撤销整段 burst 行为 |
| L2 视觉回路（子规划） | 🔄 V0 实测通过 + elision 已落地（2026-07-28） | hero 叠字改造 ✅、R4-1 尺寸回填 bug ✅、look **去重已取消并落地**（2026-07-28，连同请求级 K=2 media elision）✅、快照降噪 ✅——待下轮冒烟验证（护栏回归 + 叠字产出 + elision 后 token 峰值 <100K） |
| L2 营销字体：普惠体（子规划） | ✅ 已实施（2026-07-27） | 9 字重 PuHuiTi bundle（62MB）+ 8 素材类型改 `['Alibaba PuHuiTi']` + prompt 强约束 + _headers TTF MIME——`architecture/l2-marketing-font-puhuiti.md` |
| L3 需求单节点 | ✅ V1 已实现 | —— |
| L3 类型显性化 | ✅ 已实现（chips + 预推断 + 自定义尺寸兜底） | —— |
| L3 选区注入 | ✅ 已实现 | —— |
| L3 制作清单 + 派生 | ⬜ 待启动 | 依赖注册表 per-rootFrame 键控（见 `architecture/l2-context-engineering.md` 评审） |
| L3 导出流程 | ⬜ 待启动 | —— |
| L3 ask 工具 / 生图进度 | ⬜ 待启动 | checkpoint 从对话 → UI 迁移主线（见 `../review/2026-07-27-agent-design-review.md`） |
| L3 品牌包 | 🅿 载体已就位（=library，`architecture/l2-resource-library.md` §11）；沉淀/迭代机制仅规划缓做（§11.3） | 多品牌已决策 v1 一库=一品牌（§11.4）；数据维度 + 用户视角（"我的品牌"）待启动 |
| L2 素材资源库（子规划） | ✅ v1 已实施（2026-07-30）；详见 `history/l2-resource-library-history.md` §9.3 实施记录 | 冒烟回归：营销模式跑通默认库出类型 → MarketingConfigBar 手动锁定类型/风格 → setup 出锚点→ references 注入参考区全链路 |

## 当前执行顺序

**第 4 轮回归（待跑，最高优先级）**：护栏修改/删除/有意修改/类型切换 + CP3 图片来源 + 用户素材识别 + 叠字 hero 产出 + look 行为变更新版（用例见 `knowledge/error-catalog.md` §待验证场景）；跑前用 TEST-1234 法确认图片对模型可见（`architecture/l2-visual-loop.md` §3.1）。

**已完成的轮次**（详细记录见 `history/`）：
- L2 视觉回路 V0 优化迭代 ✅（2026-07-27）— `history/l2-visual-loop-history.md`
- L2 营销字体：普惠体 ✅（2026-07-27）— `architecture/l2-marketing-font-puhuiti.md` + `history/l1-image-gen-history.md` 中的相关 误诊
- L2 视觉回路：通道 A chat-completions 改写 ✅（2026-07-29）— `history/l2-visual-loop-history.md`
- L2 上下文工程 ✅（2026-07-28 全部实施）— `history/l2-context-engineering-history.md`
- L2 AI undo coalesce ✅（2026-07-28 实施完成）— `architecture/l2-ai-undo-snapshot.md`
- L2 视觉回路 V1/V2 ✅（2026-07-29 完成）— `history/l2-visual-loop-history.md`
- L1 生图工具优化 ✅（2026-07-28 实施完成）— `architecture/l1-image-gen.md`

## 待决事项汇总

各设计文档内的待决项不变，跨文档的开放议题见 `../review/2026-07-27-agent-design-review.md` §待讨论议题；品牌包多品牌已决策 v1 一库=一品牌（`architecture/l2-resource-library.md` §11.4），沉淀机制缓做。