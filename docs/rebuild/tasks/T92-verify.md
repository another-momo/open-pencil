# T92-verify · look-tool UI 工具卡片 base64 裁剪 + 模型通道占位符 omit

> **状态**：🟡 本地已验，独立核验待 CI / 主 agent 验收
> **时间**：2026-09-04

## 验收对照

| 项 | 计划 | 实测 | 通过 |
| --- | --- | --- | --- |
| 工具卡片展开 media 输出裁剪 | base64 → `[omitted N chars]`，其余字段原样 | tool-output-display.test.ts 例 1 钉扎 | ✅（单元层） |
| 非 media 输出不误裁 | 原样 JSON.stringify | 例 2 钉扎 | ✅ |
| errorText / error 输出路径不回归 | 透传语义不变 | 例 3/4 钉扎 | ✅ |
| 模型通道 content[1].text omit base64 | 无占位符、无 base64 键 | 例 5 钉扎（sanitizeMediaToolOutputForModel） | ✅ |
| UI 通道占位符语义不动 | sanitizeMediaToolOutput 保持 `[inlined as file part, N chars]` | look.test.ts 既有钉扎零改动，套件 112/112 | ✅ |
| 门禁 | oxfmt / tsgo / vue-tsc / oxlint / zones | 全绿（见 T92-self-check §2） | ✅ |

## 端到端真值（待主 agent / owner 验收时补）

1. dev server 起服 → 让 AI 调 look → 展开工具卡片 → base64 显示为 `[omitted N chars]` 占位，缩略图（file chunk <img>）不受影响
2. 模型轮次 history 中 look 结果的文本副本不含 `inlined as file part` 占位符

> 本文件为占位 stub：本地门禁与单测已验，独立核验与浏览器端真值待 CI / 主 agent 验收补录。
