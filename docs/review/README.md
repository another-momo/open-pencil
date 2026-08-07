# 评审记录索引

按时间倒序。每份标注：讨论主题 / 主要影响的架构文档 / 状态（已被设计文档吸收 / 仍是 ORPHAN）。

> ⚠ **本索引落后于目录**：`docs/review/` 现有 15 份评审，下表列出 10 份。缺 5 份待补：`2026-08-03-anchor-design-review.md`、`2026-08-03-fork-ci-known-issues.md`、`2026-08-04-look-tool-review.md`、`2026-08-05-state-mechanisms-review.md`、`2026-08-06-system-prompt-marketing-review.md`。

| 日期 | 文件 | 主题 | 主要影响 | 状态 |
|---|---|---|---|---|
| 2026-08-07 | long-image-design-quality-review.md | 长图设计质量：UI 感 vs 海报感。三层根因（能力披露缺口 / base 数值常量锁死比例 / 度量与流程只优化一致性）；核心实证：引擎已支持渐变·多重填充·蒙版·17 种 blend，prompt 明确否认其存在 | system-prompt-base.md + architecture/l2-agent-mode.md §1.2/§1.3/§9.3 + knowledge/methodology.md §4 | 待吸收（新） |
| 2026-08-01 | marketing-workbench-branch-review.md | 营销工作台分支全景评审（67 commits / 161 文件 / +15,280 / -340） | 全 architecture/ | 待吸收（最新 8-1 写） |
| 2026-07-31 | l2-resource-library-review-verification.md | 实习生 review 复核：抓 4 真问题 + 1 失真 + 1 错位；3 个 P0 标只有 1 个成立 | architecture/l2-resource-library.md | 已被 #4 吸收 |
| 2026-07-31 | l2-resource-library-post-iteration-review.md | 资源库 v1 迭代后 review：增量 6 commit、5 项新增；3 项必改（状态双源 P0、跨 graph refInjections P1、注入后 chip 不更新 P1） | architecture/l2-resource-library.md | 部分吸收（见 §9.3 实施记录） |
| 2026-07-30 | l2-resource-library-implementation-review.md | L2 资源库 v1 落地评审：Q1–Q13 全部 1:1 落地，6 项冒烟前必改 + 7 项可选改进 | architecture/l2-resource-library.md | 已被 design 吸收 |
| 2026-07-29 | visual-loop-implementation-review.md | 视觉回路 V0 实现评审：7 项中 6 项属实，1 项半实现，4 类错配中 2 项损害 V0 结论可信度；推翻 l2-visual-loop §4 两级截图 + §5 #4 方向 | architecture/l2-visual-loop.md | 已被 design 吸收 |
| 2026-07-29 | marketing-l2-resources-validate-review.md | L2 资源/validate 机制评审：§3/§4/§5 高同构，1 实现缺口（render 未挂 overrides），§11 给出 type/profile/reference 三关切解耦 + Library .fig 重构方向 | architecture/l2-agent-mode.md §3/§4/§5 + architecture/l2-resource-library.md | 已被 design 吸收 |
| 2026-07-29 | l1-image-gen-optimize-review.md | L1 生图工具优化全清单验证：plan 8 项全部落地，0 功能缺口；新增 2 类发布前必做 | tasks/l1-image-gen-optimize.md / architecture/l1-image-gen.md | 已被 history/l1-image-gen-history.md 吸收 |
| 2026-07-27 | context-engineering-review.md | 上下文工程 plan 评审：方向成立，5 处需修订（双数据源、声明名不副实、窗口化未排除用户消息等） | architecture/l2-context-engineering.md | ORPHAN（待补 backlink 或归档） |
| 2026-07-27 | agent-design-review.md | 营销 Agent 整体设计评审（4 大架构盲区：瞎子/无度量/零下限/骨架靠模型现场生成） | architecture/l2-agent-mode.md + architecture/l3-workbench.md / l2-context-engineering / l2-visual-loop | 已被 README + 多份 design 吸收 |

> **ORPHAN 处理建议**：1 份无 backlink 评审（2026-07-27-context-engineering-review.md）指向已被全面重写的旧版 l2-context-engineering，建议保留以备审计。其余 4 份（虽然在本表中已归类为"已被吸收"）无独立 backlink 必要，仅作历史存档。
