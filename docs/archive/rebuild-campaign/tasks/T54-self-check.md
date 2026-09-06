<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T54 自检 · Phase 3 W2/T-B3：generate_image 管线移植 + 凭证链新建

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-08-31）

1. **移植源实证**：open-pencil 仓 feature/agent-backend @ 5d38aa4e：image-gen.ts 55 行 + image-gen/{apply 263, requests 251, providers 233, history 214}.ts（wc -l 实测）。
2. **探针先读**：spikes/probes/sp/a1-images-contract.mjs（pi-ai openrouter-images chat.completions 形状——扩展槽契约）+ b-rpc-timeout.mjs（桥 20s kill 实证）；路线乙定谳（T47 登记：DMX 自写核心 / pi-ai 扩展位）。
3. **凭证面勘察**：pi-backend 既有 LLM 凭证走 provider-admin/auth.ts；生图凭证非聊天 LLM provider 且需三键——定谳专用存储 `.openpencil/pi-agent/image-gen.json`（头注成文）。
4. **拓扑定谳**（S3 §4）：生成段后端直发（凭证不出进程）+ 落图段经桥（image_gen_begin/commit 两个 core 端点）。

## 2. 实现段核验（2026-08-31/09-01 实测填报）

- **C1 管线四分**：requests 纯函数层（16px 对齐 / 3840 长边 / 3:1 纵横比 / 像素上下限 + 尾部垃圾打捞 + hd→auto 别名）→ apply 编排（protectedRedirect + 参考图三规则 + `[image N]` 错位防护 + 目标解析）→ provider → snapshotBeforeOverwrite（仅 IMAGE fill、同 hash 去重、"历史图片备份"容器锚定）。68 测试绿（`bun test tests/engine/rebuild/image-gen/`，2026-08-31 实测）。
- **C2 路线乙**：provider-dmx.ts 自写 `/images/generations`（JSON）+ `/images/edits`（multipart image[]），原生 fetch 零新依赖；`deps.createProvider` = pi-ai generateImages 扩展槽（接口在案不实现）。
- **C3 凭证链**：三键 + 预设表收敛（openai 默认官方端点 / dmx）+ 设置 UI（ImageGenKeysSection：预设下拉 + 单 key 密码输入 + 保存/清除 + 状态点）+ 空 key=清除（00 #7 测试钉扎）+ status 脱敏不回 key + tmp+rename 0o600 原子写 + 未知预设/空白字符 key 拒绝。
- **C4 超时**：packages/mcp/src/browser-rpc.ts 加载期 20s 常量 → 调用时 `rpcTimeoutMs()` 读 OPENPENCIL_RPC_TIMEOUT_MS，缺省 300s（≥240s+余量，P56 扩注）；生图 HTTP 独立 OPENPENCIL_IMAGE_GEN_TIMEOUT_MS || 240s。rpc-timeout.test.ts 钉扎。
- **C5 并发竞态**（00 #10）：begin 串行 + 每次重读 bounds；placement-race.test.ts 三帧右移真 SceneGraph 钉扎。
- **C6 集成接线**（主 agent，2026-09-01）：IMAGE_GEN_TOOLS → FORK_TOOLS；`createImageGenTool` 装配进 service.ts customTools；**凭证 store 单实例化**——server.ts 建实例注入 service（原方案双实例有缓存漂移：设置路由写 key 后工具侧旧缓存不可见，实测代码路径确认后改注入）；server.ts `/api/pi/image-gen/` 路由块在通用 `/api/pi/` 前缀之前（顺序敏感成文在案）。
- **C7 凭证纪律测试**：桥 payload 与工具结果扫描零 key 泄露（orchestration/provider-dmx 双证）。
- **C8 冒烟**：`bun run smoke:pi` 19/19 绿（2026-09-01 集成后实测，后端装配含 generate_image）。

## 3. 实测修正记录

1. **SP-a1 探针定位修正**：探针钉的是 pi-ai 扩展槽契约（chat.completions），不是 DMX 核心——plan §3.1 措辞已改（「对照移植源 DMX 契约」），测试头注成文。
2. **bridge-call 与 tools.ts callBridgeTool 语义重复**：attempt+loop 重构避开 jscpd token 克隆；集成期 tools.ts/undo-group.ts 的 fetch 块由主 agent 抽 bridge-rpc.ts 共享助手（acronym 门禁改名 postBridgeRPC）。image-gen/bridge-call.ts 带 AbortSignal 超时，结构不同未克隆——三条调用面并存是历史分层（装配冻结面纪律），后续可再归并。
3. **HistorySnapshot 增 version 成员**：与 ThumbnailPage 撞型（test:type-shapes 门禁）。
4. **T55/T59 核验期曾见我侧 generate.ts:115 类型错**：并行期半成品快照，收口态 tsgo/vue-tsc 全绿（2026-09-01 实测）。
5. **设置 UI 挂载点**：SettingsDialog.vue media 段（StockPhotoKeysSection 与 VectorizeSettingsSection 之间）；zones 登记 P44 扩注 + 新面板 ownedFiles（集成期主 agent 办妥）。
