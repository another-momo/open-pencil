<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T14-self-check.md · T14 自检

> **T 编号**：T14（Phase 1-X 实施 · 插件骨架产品化，MS-X1）
> **分支**：`rebuild/v2`
> **状态**：W1-W4 + W6 全绿；无新阻塞（T13 模型面阻塞照旧待 owner 补 key）

## 1. 结论速览

| # | 工作项 | 结论 | 证据 |
|---|---|---|---|
| W1 | `workbench/` ownedRoot 登记 | ✅ | §2.1 |
| W2 | 骨架落地（manifest/tsdown/tsconfig/host+client/preset/README） | ✅ | §2.2 |
| W3 | 沙盒装机冒烟（island + 桥在线 + preset） | ✅ | §2.3 |
| W4 | **HMR 决策点证伪** | ✅ **A 级：模块级热替换** | §2.4 |
| W6 | CI workbench-build job | ✅ | §2.5 |

**MS-X1 达成：骨架可 `dsh plugin` 安装、版本钉死 rc.1、开发回路 = `npm run dev` + dsh 自动模块级热替换。**

## 2. 分项证据

### 2.1 W1 · ownedRoot 登记

【事实】`tools/zone-registry/zones.json` ownedRoots 含 `workbench/`（`node -e` 读 JSON 实证，2026-08-22）；`bun run check:zones` → clean（added 计数随三件套落盘变动，核验时点为 148 全 owned，2026-08-22）。落点决策（workbench/ 独立目录而非 packages/ workspace）与理由见 [T14-plan.md §1.2](T14-plan.md)。

### 2.2 W2 · 骨架落地

【事实】文件集（全部真实实现，D19 无占位）：`workbench/{package.json, cordis.patch.yml, tsconfig.json, tsdown.config.mjs, .gitignore, README.md, src/index.js, src/client/index.jsx, presets/openpencil-design/{preset.yml, agent.cordis.yml}}` + package-lock.json。

【事实】验收命令（2026-08-22）：`cd workbench && npm ci --no-audit --no-fund` → added 60 packages；`npm run build` → node/client 双产物 Build complete；X1 回归守护：`node --check lib/index.js` 通过、`lib/client.js` jsx-runtime 引用 1 处、无 `createPortal)(<` 生 JSX、以 `window.__ModuleLoader__.load` banner 开头。

【事实】依赖全部钉精确版本且取 T12 spike lockfile 实证值（tsdown 0.22.14 / react+react-dom 18.3.1 / vue 3.5.18 / ws 8.18.3）。React 不进产物（tsdown external，宿主经 `__ModuleLoader__` require shim 提供）；tsconfig.json 带注释固化 X1 教训（rolldown 上溯命中仓库根 jsx:preserve 的风险）。

【事实·教训】Windows 下 `npm ci` 与运行中的 `tsdown --watch` 冲突：`EPERM unlink rolldown-binding.win32-x64-msvc.node`（2026-08-22 两连发，日志在 npm cache）；根因是 TaskStop 只杀 npm 壳、tsdown 孙进程变孤儿持锁（`Get-CimInstance Win32_Process` 定位 PID 后 taskkill 解决）。**规矩：npm ci 前先停 watch。**

### 2.3 W3 · 沙盒装机冒烟（2026-08-22，Playwright 实测）

- 沙箱 profile 换装：`dsh-home/profiles/web/package.json` 依赖改 `openpencil-marketing: link:<workbench>`、bundles 数组同步；`dsh plugin --profile web install` 建链（pnpm Done in 870ms）；宿主重启 stdout 行 `[openpencil-marketing] preset install: {"installed":false,"reason":"already present",...}`（新前缀实证跑的是产品化代码；该行在宿主启动终端/后台任务 stdout 捕获，不在 host-sandbox/dsh-web.log——核验 F1 注记）
- island：`[data-openpencil-island='react-host']`=1、`[data-openpencil-vue='root']`=1、`window.__openpencilIsland` = {reactMounts:1, vueMounts:1, vueUid:0, errors:[]}（页面内 evaluate）
- **桥状态真实功能**：面板显示「编辑器桥 在线 · 2ms」（7600 WS 桥服务端在跑，浏览器↔编辑器 B↔C 链路 5s 心跳）
- console：0 error 0 warning（全量 consoleMessages）
- preset 面：RPC `session.create {agentPreset:"openpencil-design"}` → `{ok:true, value:{sessionId, agentPreset:"openpencil-design"}}` 回显接受（沙盒已有会话未受影响）
- 截图：`workbench/evidence/t14-island-smoke.png`

### 2.4 W4 · HMR 决策点证伪（spike 04 §5.2 决策点 4，2026-08-22）

**结论：A 级——dsh web 监听 client module 产物变化并做模块级热替换，开发回路无需手动刷新、无需重启宿主。**

实测序列（tsdown --watch 运行中，Playwright 页面内 evaluate）：

| 轮 | 动作 | 结果 |
|---|---|---|
| 0 | 基线 | reactMounts=1, vueMounts=1 |
| 1 | src 改 header 加 `HMR-PROBE` → watch 316ms 重建 | **无手动刷新**，页面 header 变为新文案，reactMounts/vueMounts=2，vueUid 归零（新 Vue app），`window.__openpencilIsland` 计数器存活（=非整页刷新，系模块级替换：dispose→重新 apply→重挂载） |
| 2 | 再改 `HMR-PROBE-2` 复现 | mounts=3，同机制，console 0 error |

- 探针改动已回退（`grep -c HMR-PROBE lib/client.js` = 0）；截图 `workbench/evidence/t14-hmr-probe.png`
- 已知特性（非缺陷）：岛内 Vue 状态每次热替换重置。产品架构不受影响——画布状态在编辑器进程（7600 桥另一侧），岛内只挂 UI 态；X5 已证 session 切换不卸载
- 开发回路成文：[attic/dsh-workbench/README.md](../../../attic/dsh-workbench/README.md)「开发回路」节

### 2.5 W6 · CI 接线

【事实】`.github/workflows/ci.yml` 新增 `workbench-build` job：checkout → setup-node 22 → `npm ci && npm run build`（working-directory: workbench）→ X1 回归守护（jsx-runtime 存在 + 无生 JSX + ModuleLoader banner）。zones.json 登记 P35（ci.yml 为既有 patch 文件，新增 patch 行）。远端证据：闭环 commit 7643ca39 的 run 32568952869 因 zones.json 格式（oxfmt 内联数组）红、本 job 与 Rebuild discipline 均绿；修复 commit 7722d445 的 run 32569154626 全绿（2026-08-22）。

## 3. 阻塞与遗留（如实）

- 无新增阻塞。T13 披露的 S-X 模型面（X3 模型调工具 / X6 模型回复）仍待 owner 补 DeepSeek key，不在本 task 范围
- 遗留（不阻塞，后续 task 自然覆盖）：岛内状态热替换重置的应对（如需要）随 T15/T17 设计；`dsh plugin add <npm 包>` 的发布形态待真实分发需求

## 4. 身份

本文件是 T14 的自检（self-check），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律；核验见 [T14-verify.md](T14-verify.md)。
