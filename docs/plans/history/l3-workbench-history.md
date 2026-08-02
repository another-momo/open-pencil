# l3-workbench-history (历史)

> **来源**：从 `../architecture/l3-workbench.md` 切出的实施/时间线/误诊记录。
> 本文件按"只追加"原则归档；新讨论请开新 §。
> 当前正确设计见 `../architecture/l3-workbench.md`。

## 4. 模块路线图

**可实施性核查（2026-07-22，对照代码）**：pluginData 标记可行（`SceneNode.pluginData` 存在且 .fig 有 plugin-data 序列化）；便签样式用普通 fill 即可，导出以设计根 frame 为对象天然排除；chips 与 AI 联动走 app 层 `onAfterExecute` 钩子（`listMaterialTypes` 需补导出）；选区注入读 `store.state.selectedIds`；AI 读写需求单用现有 find/get_node/render/set_text，零新工具；自定义尺寸兜底需 setup 工具加 width/height 覆盖参数（小改动）；注册表按根 frame 键控在制作清单启动时才需要。

| 模块 | 断点归属 | 工作影响 | 方案位置 | 状态 |
|---|---|---|---|---|
| 需求单节点 | 起点断点（输入面） | 高 | §3.2.2 | ✅ V1 已实现（标记 helper + 创建按钮 + prompt 集成） |
| 类型显性化入口 | 起点断点（辅助） | 中 | §3.1 | ✅ 已实现（chips + 本地预推断 + 锁定注入 + AI 同步 + 自定义尺寸兜底） |
| 画布输入约定（选区/命名/游离节点） | 起点断点（输入面） | 中 | §3.2.1 / §3.2.3 | ✅ 选区注入已实现（发送时附带选区信息） |
| 制作清单 + 派生工作流 | 迭代断点 | 高 | §3.4 | ⬜ 待启动（依赖需求单落地） |
| 导出流程 | 终点断点 | 中高 | 根 frame → PNG/JPG 多倍图，营销化包装 | ⬜ 待启动 |
| ask 工具 + 选项卡片 | ——（体验优化） | 中 | 规范 checkpoint 交互质量 | ⬜ 待启动 |
| 生图进度展示 | ——（体验优化） | 中低 | tool call pending 状态增强，工作量小 | ⬜ 待启动 |
| 品牌包（=library 载体） | 起点断点 | —— | §3.3 / `../architecture/l2-resource-library.md` §11 | 载体已就位；剩余：多品牌决策（§11.4）+ 数据维度 + 用户视角 ⬜；沉淀/迭代机制 🅿 仅规划缓做 |
