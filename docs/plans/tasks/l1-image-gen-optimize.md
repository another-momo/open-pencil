# L1 生图工具优化（实施任务）

> 任务记录（带 Step / 改动量 / 验证 / 回滚）。**当前正确设计见 `../architecture/l1-image-gen.md`**；验证/回滚/评审后续修正见 `../history/l1-image-gen-history.md`。
>
> 上层总览见 `../00-overview.md`，L1 MVP 见 §3。`../README.md` 是状态唯一来源。

## 实施步骤骨架

按 `../architecture/l1-image-gen.md` §P0–P2 各小节逐项落地。改动量取自原 plan（实施前估算，2026-07-28 已全部落地）：

| 改动 | 代码位置 | 改动量 |
|---|---|---|
| P0: 参考图生图（references 解耦 + 路由 + 失败处理） | `apply.ts` / `providers.ts` / `requests.ts` | ~60 / ~40 / ~15 LOC |
| P0: 尺寸规范化（移植 `normalizeDimensions`） | `requests.ts` | ~35 LOC（移植 + 单测） |
| P0: 超时控制（ofetch `timeout` + 第 4 参 setter） | `providers.ts` / `setImageGenCredentials` | ~5 LOC |
| P1: 错误信息（FetchError 解析 `err.data`） | `providers.ts` | ~30 LOC（try/catch 包裹） |
| P1: 非 IMAGE 节点作为参考（`asImage: true` 内部渲染） | `apply.ts` / `requests.ts` | ~20 + ~10 LOC |
| P2: `moderation`/`background`/`output_compression` 参数对齐 | `providers.ts` | < 10 LOC（body / FormData 字段补齐） |
| P2: 三处文档更新（tool description + 2 system prompt） | `image-gen.ts` / `system-prompt.md` / `system-prompt-marketing.md` | 编辑，无 LOC |

## 验证

- **单元测试**：`tests/engine/tools/image-gen/` 全部通过（28 个 case）
- **联调验证**（落地后必跑）：7 场景（重点：编辑含目标自身、替换不带旧图、`asImage: true` 渲染参考）
- **冒烟**：第 4 轮回归前完成

详见 `../history/l1-image-gen-history.md`（§验证与测试 / §回滚方案 / §评审后续修正）。

## 实施记录

| 阶段 | 状态 | commit | 说明 |
|---|---|---|---|
| 2026-07-28 P0–P2 全部实施 | ✅ | — | 28 个单元测试通过 |
| 2026-07-29 评审 + 二次走查 | ✅ | — | 命名修正 + prompt 触发引导 + 4 类单测补全 |
| 2026-07-30 联调验证 7 场景 | ⬜ 待跑 | — | 重点场景见 `../architecture/l1-image-gen.md` §场景验证 |

详细时间线、误诊教训、commit hash 见 `../history/l1-image-gen-history.md`。