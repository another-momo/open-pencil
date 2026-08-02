# l2-visual-loop-history (历史)

> **来源**：从 `../architecture/l2-visual-loop.md` 切出的实施/时间线/误诊记录。
> 本文件按"只追加"原则归档；新讨论请开新 §。
> 当前正确设计见 `../architecture/l2-visual-loop.md`。

## 5. 实施状态总览

| # | 事项 | 期次 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | `look` 工具 + 通道 A 投递（`toModelOutput` media part） | V0 | ✅ 2026-07-27 | `packages/core/src/tools/marketing/look.ts`、`ai-adapter.ts:217-227` |
| 2 | look 可读性声明 + 子节点钻取指引 + focus 并入 note + JPEG q80/白底 | V0 | ✅ 2026-07-29 | 评审问题 2 / #5 / #6 / #7 |
| 3 | debug log 媒体脱敏 + stats 单列媒体行 + cache read/write 同显 | V0 | ✅ 2026-07-29 | 评审问题 1；token 基线必须在此之后量 |
| 4 | chat UI 工具卡片缩略图（替代 base64 JSON） | V0 | ✅ 2026-07-29 | 评审问题 1 |
| 5 | prompt 规则：CP2/CP4 前置门禁、生图验收、look 纪律 | V0 | ✅ | CP4 可读性已改为"describe 定位候选 → look 确认"（评审 §3.8） |
| 6 | media elision（K=2，per-turn，可配 1-3） | V0 | ✅ 2026-07-28；**2026-07-29 修复后方真正生效** | `prepareCall` 原先只读 `options.messages`，而真实路径传的是 `prompt` 数组——elision 落地后从未执行过一次，2026-07-29 修复双形态读取；演进待定事项归 l2-context-engineering.md |
| 7 | 端到端接线测试（UIMessage→转换→elision，防 media 静默退化为 JSON）+ look 单测 | V0 | ✅ 2026-07-29 | 评审问题 5 |
| 8 | **通道 A chat-completions 改写**（media tool-result → user 消息图片） | V0 | ✅ 2026-07-29 | 方案见 §3.1；MiniMax-M3 completions + Anthropic 端点双路径实测可见图 |
| 9 | V0 实测：第 4 轮回归（kimi/minimax 多模态跑朋友圈广告） | V0 | ⬜ 待跑 | 投递路径已验证；本轮重点采信视觉判断质量结论 |
| 10 | 通道 B（显式模式 + 独立凭证 + "复制主模型配置"按钮 + look 内部分支） | V1 | ✅ 2026-07-29 | `marketing/vision.ts` + `look.ts` B 分支（返回 analysis 无 base64）+ 设置面板 Vision section；B 返回走 JSON 不进 media，elision 自然跳过 |
| 11 | 素材理解（需求单素材/拖入图 → 内容描述 + 字节 hash 缓存 + 写设计状态） | V1 | ✅ 2026-07-29 | B 模式按 imageHash 自动缓存 analysis（命中零成本）；prompt 素材区扫描规则 + 描述写 AI结论区（A 模式同样可用） |
| 12 | lint 降噪（R3-4 启发式警告降级为"由图回答"） | V2 | ✅ 2026-07-29 | describe `INFO_PATTERNS` 收编 subpixel/grid/Low contrast/Near-invisible/gap≫padding；结构 error 保留 |
| 13 | `look` 按 chatMode 隔离（ui 模式省略 id 必然报错） | 小项 | ✅ 2026-07-29 | `createAITools(store, chatMode)` 过滤 look/setup_material_type/validate |
| 14 | `export_image` chat 死分支 + prompt "Never use export_image" 清理 | 小项 | ✅ 2026-07-29 | prompt 死规矩已删（工具仍在 EXTENDED 服务 MCP/CLI） |
| 15 | eval 工具不兜底视觉 | V0 | ✅ | eval sandbox 不暴露 `exportImage` |
| 16 | ~~两级截图 / 1568 第二档 / zoom 预算硬约束 / 能力探测自动降级 / overview 替代一致性盲规则 / look dedup~~ | — | ❌ 已撤销 | 依据见 §3、§4、评审 §3.4/§3.7/§4.9 |
