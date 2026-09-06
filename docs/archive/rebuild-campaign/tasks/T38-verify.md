<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T38 核验报告 · 三症状回归修复

> **状态**：已完成 | **时间**：2026-08-28 | **核验人**：主 agent（浏览器实证 + 进程/文件取证）
> **基线**：`aabacb0a` + T38 改动（修复后 dev server 全量重启实测）

## V1 症状①：输入框下模型名恢复 ✅

- 方法：playwright 开 `http://localhost:1420`，读 `[data-test-id="chat-pi-model-label"] span.truncate` 文本。
- 修复前实测（2026-08-28 18:05，`[::1]` 与 `localhost` 双 origin 复核）：`""`（空串）。
- 修复后实测（2026-08-28 18:38，重启后）：`"后端默认（openrouter/free）"`——fallback 链（assignment null → fork seam 默认值）正常。

## V2 症状③：设置面板 thinking 等级恢复 ✅

- 方法：设置 dialog → AI 和代理 → 设计模型区选 provider=openrouter，读 `[data-test-id="pi-design-thinking-select"]` 全部 option 文本。
- 修复后实测（2026-08-28 18:42）：`关闭 / 最低 / 低 / 中 / 高 / 极高` 六项全非空，`value=off`。
- 附带确认：Provider 下拉首项「后端默认（openrouter/free）」与「114 个模型」等 params 函数键（`{count} models`）渲染正常——诚实 Ref 类型未丢 params 函数形态。
- 操作未点「保存」，localStorage 无 assignment 写入（实测 localStorage 键清单无 pi-design-assignment），用户态零污染。

## V3 症状②：工具桥链路恢复 ✅

- 方法：重启 dev server（vite 插件新代码生效的前提）后，聊天框发送「用工具在画布上创建一个 100x100 的矩形，位置 (50, 50)，然后告诉我创建结果」。
- 修复后实测（2026-08-28 18:43）：`Create Shape 完成` + `Get Node 完成` 两连工具调用成功，assistant 回复「已在画布上创建矩形：ID 0:3，名称 MyRectangle，位置 (50, 50)，大小 100×100」——pi-backend → discovery 文件 → 7600 桥 → 活编辑器全链通。
- 进程取证：桥 pid 15640（vite 拉起）discovery 落 `%TEMP%/open-pencil-mcp/18d901424f534c7b/mcp.json`（digest 与钉扎测试一致）；修复前默认路径残留文件指向已死 pid 16584（8/26 桥）——断链根因的现场证据。
- 模型路径：openrouter/free（owner 已配置 OpenRouter 凭据，面板显示「已连接」）。

## V4 门禁全绿 ✅

见 [T38-self-check.md §2](T38-self-check.md) 实测表：tsgo / check:vue / lint / format:check / check:zones / check:docs / check:bindings / check:tasks / bun test rebuild（3/3）/ smoke:pi（80/80）全绿。

## V5 观察项（不阻断收口，登记待查）

1. **工具落点文档与可见文档可能不一致**：V3 创建的矩形落在 chat 会话族谱绑定的文档（docKey 血缘），当前可见的空白 Untitled 文档图层面板为空、`get_node` 不带 document_id 时报 502 no_app——与 T22 D4 的 document_id 注入语义一致（chat 绑定哪个文档就改哪个），但「当前可见文档 ≠ chat 绑定文档」的体感可能困扰。登记为后续观察项，非本任务修复面。
2. **多浏览器页签并存时桥会被反复 restart**：dev 拓扑下每个页签的 MCP runtime start 都会 POST dev-control restart（实测桥 pid 15640→17288 漂移、先连的编辑器被踢成 no_app）。上游原语义如此（单 app attach），多开场景下次第连接——登记待查，非本任务引入。
3. **`[::1]` origin 下桥 CORS 必败**：dev 桥 corsOrigin 硬编码 `http://localhost:1420`（portless-route.ts:18），用 `[::1]` 或 `127.0.0.1` 打开 app 会导致桥健康检查 CORS 失败。用户正常用 `localhost` 不受影响——登记为已知边界。

## 结论

三症状全部实证修复，门禁全绿，**可以收口**。
