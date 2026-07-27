# 营销工作台规划：文档地图与状态面板

> 最后更新 2026-07-27。本文档是所有规划文档的**唯一状态来源**。规则：
>
> 1. **状态只在本文件维护**——设计文档不写任务进度，只描述"当前正确的设计"；
> 2. 知识库（`knowledge/`）只追加不修改；
> 3. 评审记录（`../review/`）落档后不再改动，结论通过修订设计文档生效。

## 文档地图

| 文档 | 内容 | 保质期 |
|---|---|---|
| `00-overview.md` | 产品定位、三层架构、落地顺序、源码参考 | 易变，随进展更新 |
| `l2-agent-mode.md` | L2 主设计：理念、工作流、素材类型、资源体系、校验 | 半持久 |
| `l2-context-engineering.md` | L2 子规划：上下文工程——media elision、跨 session 恢复、类型关键词下沉（问题 → 方案 → 实施顺序） | 半持久 |
| `l2-visual-loop.md` | L2 子规划：视觉回路——多模态看图、look 工具、与上下文工程的顺序约定 | 半持久 |
| `l3-workbench.md` | L3 工作台交互：三类信息模型、需求单、类型显性化、制作清单 | 半持久 |
| `knowledge/error-catalog.md` | 冒烟测试错误目录（实测驱动迭代的核心资产，持续追加） | 只增不改 |
| `knowledge/methodology.md` | 实测沉淀的方法论：注入可靠性排序、可判定性划分等 | 只增不改 |
| `archive/` | 已完成或废弃的规划 | 档案 |

评审记录见 `../review/`。

## 模块状态

| 模块 | 状态 | 下一步 |
|---|---|---|
| L1 生图工具 | ✅ 完成 | —— |
| L2 Phase 0 模式切换 | ✅ 完成 | —— |
| L2 Phase 1 核心链路 | ✅ 代码完成 | —— |
| L2 Phase 2 安全护栏 | ✅ 代码完成 | 护栏场景随第 4 轮回归验证 |
| L2 Phase 3 实测迭代 | 🔄 3 轮冒烟完成 | **第 4 轮回归**（用例见 `knowledge/error-catalog.md` §待验证场景） |
| L2 上下文工程（子规划） | 📋 已收敛重写（2026-07-27） | 4 项任务：media elision → prompt 清理 → per-rootFrame 键控 → 画布推导恢复（任务表见 `l2-context-engineering.md` §5） |
| L2 视觉回路（子规划） | 🔄 V0 实测通过 + 首轮优化完成（2026-07-27） | hero 叠字改造 ✅、R4-1 尺寸回填 bug ✅、look 去重 ✅、快照降噪 ✅——待下轮冒烟验证（护栏回归 + 叠字产出 + look 去重行为） |
| L2 营销字体：普惠体（子规划） | ✅ 已实施（2026-07-27） | 9 字重 PuHuiTi bundle（62MB）+ 8 素材类型改 `['Alibaba PuHuiTi']` + prompt 强约束 + _headers TTF MIME—`l2-marketing-font-puhuiti.md` |
| L3 需求单节点 | ✅ V1 已实现 | —— |
| L3 类型显性化 | ✅ 已实现（chips + 预推断 + 自定义尺寸兜底） | —— |
| L3 选区注入 | ✅ 已实现 | —— |
| L3 制作清单 + 派生 | ⬜ 待启动 | 依赖注册表 per-rootFrame 键控（见 `l2-context-engineering.md` 评审） |
| L3 导出流程 | ⬜ 待启动 | —— |
| L3 ask 工具 / 生图进度 | ⬜ 待启动 | checkpoint 从对话 → UI 迁移主线（见 `../review/2026-07-27-agent-design-review.md`） |
| L3 品牌包 | ⏸ 暂缓 | 优先级论证见 review，待重排 |

## 当前执行顺序（2026-07-27 评审后）

1. **L2 视觉回路 V0 优化迭代** ✅（2026-07-27 完成）：hero 叠字改造（图片工具填 Frame 背景）、R4-1 尺寸回填 bug、look 工具内去重、debug log 快照降噪
2. **L2 营销字体：普惠体** ✅（2026-07-27 完成）：9 字重 PuHuiTi bundle + 修 weightToStyle 上限 bug + 8 素材类型改 font + _headers MIME + prompt 强约束——详见 `l2-marketing-font-puhuiti.md`
3. **L2 第 4 轮护栏场景回归**（待跑）：护栏修改/删除/有意修改/类型切换 + CP3 图片来源 + 用户素材识别 + 叠字 hero 产出 + look 去重行为（用例见 `knowledge/error-catalog.md`）
4. **L2 上下文工程（收敛版 4 项任务）**：media elision（P0，R4-3 实证）→ prompt 清理 → per-rootFrame 键控（L3 制作清单前置）→ 画布推导恢复
5. **L2 视觉回路 V1/V2**：通道 B、素材理解、两级截图
6. **L3 制作清单**：注册表键控就绪后启动

## 待决事项汇总

各设计文档内的待决项不变，跨文档的开放议题见 `../review/2026-07-27-agent-design-review.md` §待讨论议题。
