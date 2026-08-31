<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T55 自检 · Phase 3 W2/T-B4：look 移植（通道 A + 媒体元数据字段化）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-08-31）

1. **移植源实证**：open-pencil 仓 feature/agent-backend @ 5d38aa4e：marketing/look.ts 370 行（vision.ts 178 行仅作通道 B 语义参考，本任务不建）。
2. **主机能力勘察结论**（核验 V 段复核一致）：目标仓 renderNodesToImage **不支持** renderInContext/clip、figma-api 无此二参、detectImageMime 缺失——三项按 plan「缺失则补实现」补齐，逐行对齐移植源同文件。
3. **媒体登记落点定谳**：不改 schema.ts 加字段（上游文件保护），登记集合放 pi-backend 侧（media-output.ts ownedRoot）。

## 2. 实现段核验（2026-08-31/09-01 实测填报）

- **C1 look 移植保真**：通道 A 代码与移植源逐字一致（核验实测 diff：唯差异 = 通道 B 整体切除无桩 / 显式 mutates:false / id 文案换 setup_design）。三档模式（original-bytes/isolated/in-context）+ 缩放（>1024 压缩下限 0.1 钳制、<512 上采样封顶 ×4、区间内 scale=1）+ 返回七字段（base64/mimeType/byteLength/channel/node/exportInfo/note）。30/30 绿（`bun test tests/engine/rebuild/marketing/look.test.ts`）。
- **C2 媒体字段化**：MEDIA_OUTPUT_TOOLS={look, export_image} 落 pi-backend；mapping.ts 对登记工具结果产出 AI SDK `file` 媒体块（data URL）+ tool-output-available details 脱敏（base64→尺寸标记）；schema.ts 零 diff（核验实证）。
- **C3 图像模态桥接**（集成期主 agent 落地核验 I 项）：tools.ts defineBridgeTool 对登记工具结果产出 pi ImageContent——模型收到真图像模态而非 JSON 内嵌 base64 字符串；文本副本脱敏保留元数据。
- **C4 主机能力链闭合**：render.ts（renderInContext/clip + JPG 白底 + supersample 对齐源）→ figma-api options 类型 → document/export/files.ts extras 透传 → figma-factory 桥转发三参（集成期补齐，原 agent 因 automation 领土纪律未碰）→ look 上下文渲染端到端可调。
- **C5 消克隆**（集成期）：svg/defs.ts 本地 detectImageMime 删除换引 #core/bytes 共享 image-mime.ts（jscpd 0 克隆）。
- **C6 回归面**：export-image/registry 既有测试 5/5 绿；rebuild 套件 172/172 绿（2026-09-01 集成后实测）。

## 3. 实测修正记录

1. **plan §1 elision 引文倒写**：误写「仅通道 B 启用时才建」，S3 §5 原文为「仅通道 A 启用时才建」——plan 已修正（核验 I1 发现），elision 后续任务归属挂 S4 §7 尾巴表（2026-09-01 登记）。
2. **测试头注过时**：look.test.ts 头注称「lookTool 未注册进 FORK_TOOLS」——集成期注册后失效，已改注（核验 I2 发现，纯注释无语义）。
3. **图模态端到端**：UI 侧 file 媒体块（mapping）+ 模型侧 ImageContent（tools.ts）双层齐备；「模型真看到图」的端到端实证归 T-D1 冒烟（plan 在案）。
4. **本机内存压力**：oxlint 全配置在 8GB 机两次 OOM（agent 报告 + 主 agent 复跑确认）；lint 门禁最终由主 agent 整跑通过（0 errors / 6 warnings max-lines 系 warn 级不拦）。
