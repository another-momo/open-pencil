<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T14-plan.md · T14 任务计划

> **T 编号**：T14（Phase 1-X 实施 · 插件骨架产品化，里程碑 MS-X1）
> **分支**：`rebuild/v2`（实施主线；zones 登记 `workbench/` ownedRoot）
> **三件套**：
> - 计划：[T14-plan.md](T14-plan.md)（本文件）
> - 自检：[T14-self-check.md](T14-self-check.md)（开工后填）
> - 核验：[T14-verify.md](T14-verify.md)（核验时填）

## 1. 任务概述

### 1.1 背景与目标

D22 拍板 dsh-X 主线、T13 收口完成后，把 T12 spike 插件（`spikes/s-x/plugin/`，proof-of-concept）产品化为正式 dsh bundle 骨架：可 `dsh plugin add` 安装的形态、精确版本钉扎（03 §5.4）、dev watch 开发回路，并顺手证伪 spike 04 §5.2 决策点 4（dev mode HMR）。里程碑 MS-X1：骨架可安装、版本钉死、开发回路可用。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **落点 `workbench/`（顶层独立目录，standalone 工具链），不进 `packages/` workspaces**
   - 理由：packages/ 十个包全是引擎层（scene-graph/pen/kiwi/fig/core/dom-css/vue/cli/mcp/harness，`package.json` workspaces 字段实测 2026-08-22），workbench 是产品面（dsh bundle），工具链正交（tsdown + react external + JSX vs 仓库 bun+tsgo+eslint）；进 workspace 会把 knip/check:packages/check:monorepo/lint 的适配成本提前到骨架期
   - 代价与回补：仓库 lint/typecheck 暂不覆盖 workbench/；自身 `npm run build` 在 CI 的接线列为可选项 W6
2. **包名 `openpencil-marketing`**（spike 04 §2.2 安装命令的目标名），`private: true`（T14 不发 npm，发布形态留 npm 标准 files/exports 备妥）
3. **React 只作 devDependency，不声明 peerDependencies**——产物经 `__ModuleLoader__` require shim 用宿主 React（spike tsdown `external: ["react","react/jsx-runtime"]` 实证）；声明 peer 会让 workspace/安装侧做无谓解析
4. **dsh 宿主钉 `@deepseek-ai/dsh@0.1.1-rc.1`**（03 §5.4），README 写安装与钉扎说明

### 1.3 范围

| # | 工作项 | 通过标准 |
|---|---|---|
| W1 | ownedRoot 登记 + 目录决策落地 | zones.json 含 `workbench/`，check:zones clean |
| W2 | 骨架文件落地（manifest / cordis.patch.yml / tsconfig[react-jsx] / tsdown 双配置含 ModuleLoader banner / src host+client 移植 / presets/openpencil-design / .gitignore / README） | 无占位（D19），全部真实可用 |
| W3 | 沙盒装机冒烟：link 进 profile、重启宿主，island 起 + console 0 错 + preset 可见 | 达到 X1/X4 级证据标准 |
| W4 | **dev watch + HMR 决策点证伪**：tsdown --watch 下改组件，实测 dsh 重载行为三档（自动热替换 / 自动刷新丢状态 / 不感知），按实测落定开发回路 | 结论 + 回路脚本/步骤成文 |
| W5 | self-check + subagent 核验 + 登记 | 三件套齐 |

### 1.4 不在范围

- 编辑器资产入岛（T15，决策点 2）；7600 token/permission 链（T16，决策点 1）；ChatPanel（T17）
- 7600 桥在骨架里仅保留 spike 已有的 ping/apply_design 工具面（沙盒 mock server 属 spike 资产，不移植）
- npm 实际发布（`npm publish` 留给有真实分发需求时）

## 2. 任务清单

- [ ] W1 zones.json 登记 `workbench/` ownedRoot
- [ ] W2 骨架落地
- [ ] W3 沙盒装机冒烟（island + preset）
- [ ] W4 HMR 证伪 + 开发回路成文
- [ ] W5 self-check + subagent 核验 + 登记
- [ ] W6（可选）CI 加 workbench build 步骤

## 3. 验收标准

- 【事实】`cd workbench && npm ci && npm run build` 产出 lib/index.js + lib/client.js；client.js 0 生 JSX（`grep -c "jsx-runtime" lib/client.js` ≥1 且无 `createPortal)(<` 形态——X1 教训固化）
- 【事实】沙盒 profile 以 `link:` 装上 openpencil-marketing 后：浏览器 island 渲染、console 0 错、agent preset 选择器可见 openpencil-design
- 【事实】HMR 三档结论有实测证据（截图/日志），开发回路 README 成文
- 【事实】check:zones/docs/bindings/tasks 全绿

## 4. 关联文档

- spike 资产源：`spikes/s-x/plugin/`（T12）；版本纪律：[03-phase-1-runtime.md §5.4](../03-phase-1-runtime.md)
- bundle 结构要求：[spikes/04-dsh-x-design.zh.md §5.1 E1-E3](../spikes/04-dsh-x-design.zh.md)；决策点 4：[同 §5.2](../spikes/04-dsh-x-design.zh.md)
- X1 tsconfig 教训：[T12-self-check.md §2.2](T12-self-check.md)

## 5. 身份

本文件是 T14 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T14-self-check.md](T14-self-check.md) / [T14-verify.md](T14-verify.md)（开工后创建）。
