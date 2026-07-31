# 营销工作台规划：文档地图与状态面板

> 最后更新 2026-07-30（v1 + 2026-07-30 续轮评审整改）。本文档是所有规划文档的**唯一状态来源**。规则：
>
> 1. **状态只在本文件维护**——设计文档不写任务进度，只描述"当前正确的设计"；
> 2. 知识库（`knowledge/`）只追加不修改；
> 3. 评审记录（`../review/`）落档后不再改动，结论通过修订设计文档生效。

## 文档地图

| 文档 | 内容 | 保质期 |
|---|---|---|
| `00-overview.md` | 产品定位、三层架构、落地顺序、源码参考 | 易变，随进展更新 |
| `../library-format.md` | Library .fig 格式规范：四个 zone 的 KV/Markdown 语法、warnings 总表、作者扩展示例（与 `l2-resource-library.md` 互参） | 半持久 |
| `l1-image-gen-optimize.md` | L1 子规划：生图工具优化——references 解耦模型、尺寸规范化、超时/错误处理、非 IMAGE 节点渲染参考 | 半持久 |
| `l2-agent-mode.md` | L2 主设计：理念、工作流、素材类型、资源体系、校验 | 半持久 |
| `l2-context-engineering.md` | L2 子规划：上下文工程——media elision、跨 session 恢复、类型关键词下沉（问题 → 方案 → 实施顺序） | 半持久 |
| `l2-ai-undo-snapshot.md` | L2 子规划：AI undo snapshot 累积（嫌疑 1 修复：拆分 AI undo 栈 + chronological 优先级） | 半持久 |
| `l2-visual-loop.md` | L2 子规划：视觉回路——多模态看图、look 工具、与上下文工程的顺序约定 | 半持久 |
| `l2-resource-library.md` | L2 子规划：素材资源库——type/profile/reference 三关切解耦 + Library .fig 单一来源 + reference 用户勾选注入参考区页（避开与 brief 内素材区 zone 重名）+ readonly 降级声明式（依据 2026-07-29 资源评审 §11；2026-07-30 评审修订，执行 ready） | 半持久 |
| `l3-workbench.md` | L3 工作台交互：三类信息模型、需求单、类型显性化、制作清单 | 半持久 |
| `knowledge/error-catalog.md` | 冒烟测试错误目录（实测驱动迭代的核心资产，持续追加） | 只增不改 |
| `knowledge/methodology.md` | 实测沉淀的方法论：注入可靠性排序、可判定性划分等 | 只增不改 |
| `archive/` | 已完成或废弃的规划 | 档案 |

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
| L2 营销字体：普惠体（子规划） | ✅ 已实施（2026-07-27） | 9 字重 PuHuiTi bundle（62MB）+ 8 素材类型改 `['Alibaba PuHuiTi']` + prompt 强约束 + _headers TTF MIME—`l2-marketing-font-puhuiti.md` |
| L3 需求单节点 | ✅ V1 已实现 | —— |
| L3 类型显性化 | ✅ 已实现（chips + 预推断 + 自定义尺寸兜底） | —— |
| L3 选区注入 | ✅ 已实现 | —— |
| L3 制作清单 + 派生 | ⬜ 待启动 | 依赖注册表 per-rootFrame 键控（见 `l2-context-engineering.md` 评审） |
| L3 导出流程 | ⬜ 待启动 | —— |
| L3 ask 工具 / 生图进度 | ⬜ 待启动 | checkpoint 从对话 → UI 迁移主线（见 `../review/2026-07-27-agent-design-review.md`） |
| L3 品牌包 | ⏸ 暂缓 | 优先级论证见 review，待重排；Library .fig 形态下与素材库统一载体（见 `l2-resource-library.md` §11） |
| L2 素材资源库（子规划） | ✅ v1 已实施（2026-07-30）：default-library.fig（生成器 + 回环测试，全部文字设阿里巴巴普惠体）+ 扫库解析（LibraryIndex + warnings，包括重复 key 警告）+ `cloneSubtreeAcrossGraphs` 跨文档克隆 + setup 读库（activeProfileId + 断裂 marker-aware 引导 + 用户锁定 profile 核心穿透）+ readonly 基线机制拆除 + validate 脱库精简 + profile overlay（prepareCall）+ web dialog（默认库 + 上传替换 + fetch 失败重试 + references 注入了） + 库标识 marker（递归扫描）+ MarketingConfigBar（三配置项：类型 / 风格 / 参考，替代独立验证 type/profile/reference，参考元素注入工作文档「参考区」页避开与 brief 内素材区 zone 重名）+ render 单元出错模型净化（`<X/></X>` → `<X/>`，剥离 `<jsx>`/```</jsx>`包裹）+ l2-agent-mode.md §3/§4/§5 重写与资源汇总；62 条营销 + 2 条生成器 + 4 条 render 净化 + 1 条重绑定测试 全绿 | 冒烟回归：营销模式跑通默认库出类型 → MarketingConfigBar 手动锁定类型/风格 → setup 出锚点→ references 注入参考区全链路；自定义库重开断裂的 dialog 提示验证；render 验证模型同类输出不再硬错 |

## 当前执行顺序（2026-07-27 评审后）

1. **L2 视觉回路 V0 优化迭代** ✅（2026-07-27 完成）：hero 叠字改造（图片工具填 Frame 背景）、R4-1 尺寸回填 bug、look 工具内去重、debug log 快照降噪
2. **L2 营销字体：普惠体** ✅（2026-07-27 完成）：9 字重 PuHuiTi bundle + 修 weightToStyle 上限 bug + 8 素材类型改 font + _headers MIME + prompt 强约束——详见 `l2-marketing-font-puhuiti.md`
3. **L2 视觉回路：通道 A chat-completions 改写** ✅（2026-07-29 完成并实测通过）：`@ai-sdk/openai` chat completions 把 media tool-result 整段 JSON 文本化，kimi/minimax/openai-compatible 路径模型看不到图——已在 transport 层按 provider 分支改写为 user 消息图片（`src/app/ai/chat/media-tool-results.ts`，prepareCall + prepareStep 双钩子）。MiniMax-M3 双路径实测均可见图：completions（改写）与 Anthropic 端点（原生，浏览器 dev 走 vite proxy）；其 responses 兼容端点不可用（端侧 call_id 校验）——详见 `l2-visual-loop.md` §3.1
4. **L2 第 4 轮护栏场景回归**（待跑）：护栏修改/删除/有意修改/类型切换 + CP3 图片来源 + 用户素材识别 + 叠字 hero 产出 + look 行为变更新版（用例见 `knowledge/error-catalog.md`）；跑前用 TEST-1234 法确认图片对模型可见（`l2-visual-loop.md` §3.1）
5. **L2 上下文工程** ✅（2026-07-28 全部实施）：任务 1 media elision、任务 2 matchKeywords、任务 3 per-rootFrame 键控、任务 4 画布推导恢复（pluginData 标记 + 懒恢复）；elision 演进待定事项（OOM 根因 → 轮末永久裁剪 或 prepareStep 阈值触发）见 `l2-context-engineering.md` 文末
6. **L2 AI undo coalesce** ✅（2026-07-28 实施完成）：burstId + coalesceKey 合并 AI undo entry；冒烟验证（内存 + 撤销行为）随第 4 轮回归
7. **L2 视觉回路 V1/V2** ✅（2026-07-29 完成）：通道 B（显式模式 + 独立凭证 + 复制按钮 + look 内部分支）、素材理解（imageHash 缓存 + prompt 素材区扫描）、lint 降噪（describe 视觉类 warning 降 info）、look 按 chatMode 隔离、export_image 死规矩清理——见 `l2-visual-loop.md` §5 总览表
8. **L3 制作清单**：注册表键控就绪后启动
9. **L1 生图工具优化** ✅（2026-07-28 实施完成）：references 解耦 + 尺寸规范化 + 超时/错误处理 + `asImage: true` 渲染参考；评审后续批次（2026-07-30）：`export` → `asImage` 改名、marketing prompt 触发引导三处、提取失败错误 hint、不可变 finalReq、补 3 类 provider 单测——28 个单元测试通过；联调验证 7 场景待跑——见 `l1-image-gen-optimize.md`

## 待决事项汇总

各设计文档内的待决项不变，跨文档的开放议题见 `../review/2026-07-27-agent-design-review.md` §待讨论议题。
