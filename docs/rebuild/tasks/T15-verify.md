<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T15-verify.md · T15 独立核验

> **T 编号**：T15（M2 编辑器入孤岛）
> **状态**：🔄 任务进行中，尚未派单独立核验。E4 收口时由 subagent 按 §1 清单实测回填本文；当前内容为核验项预定，不构成任何「已通过」声明。

## 1. 收口核验项清单（E4 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | E1 证据真实性：`window.__openpencilIsland.canvaskit` 实测值、readPixels 回读值、console 0 错、截图 | 浏览器复现 + 对照 self-check 记录 |
| V2 | wasm 资产路由：宿主侧 `/plugins/openpencil-marketing/assets/canvaskit.wasm` 返回 200 且字节数 = 7,159,342；包内 `assets/` 随 build 生成 | curl + 文件比对 |
| V3 | E2：island 内编辑器外壳渲染、demo scene 画布可见 | 浏览器截图 + DOM 检查 |
| V4 | E3：会话切换 island 不卸载、编辑器状态保持；HMR 重挂实测记录存在且如实 | 浏览器操作复现 |
| V5 | E4：画布节点可选中/移动，console 0 错 | 浏览器操作复现 |
| V6 | 无占位（D19）：workbench/ 新增代码全部真实可用 | 逐文件审 |
| V7 | 版本钉扎：workbench 新增依赖全部 exact pin | 读 package.json |
| V8 | 远端 CI 绿（含 workbench-build job） | gh api 查 run |

## 2. 核验结论

（E4 收口时由 subagent 填报实测值与结论；本文此前不含任何核验结论。）
