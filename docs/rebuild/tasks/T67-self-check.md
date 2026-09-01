# T67 自检 · prompt 退役/挖掘 + S 文档同步

> 日期：2026-09-01。实施 = subagent（裁决变更后口径），集成验收 = 主 agent。

## 1. 范围变更记录（重要）

立项时任务 A =「system-prompt-marketing.md 原地修订 + Phase 段移出」。集成前主 agent 核实（owner 质询触发）：**该文件是孤儿**——当前每回合装配 = `studio/base.md` + `studio/workflows/longform.md` + profile 全文（active-design-host.ts:86-131 组装、service.ts:282 兜底基底）；全仓零运行时代码引用（grep 实证，命中仅历史任务文档 + 两个 T45 时代脚本）。owner 确认后裁决变更：

- 任务 A → A'：文件不修订，产出**抢救性挖掘清单**（`doc/t67-marketing-prompt-mining.md`，仓外），文件本体由主 agent 在集成时删除。
- 反向裁决条款（留存面 <40 行则并入 longform）因孤儿证据自动失效。

## 2. 交付清单

| 项 | 落点 | 证据 |
|---|---|---|
| A' 挖掘清单 | 仓外 `doc/t67-marketing-prompt-mining.md` | 19 节逐节裁决：抢救 10 节整节 + 6 节部分；消亡 4 节 + 2 段；冲突 8 处（每条带行号 + 目标面） |
| B base 候选补记 | 仓外 `doc/base-candidate-list.md` 条目 #1 | Composition Primitives，位置栏注明孤儿文件 :7-23，理由栏注明两反例桌面推演「是」+ 待 W5 复核标注 |
| C S 文档同步 | S1 14 条 / S2 11 条 / S3 7 条 / S4 7 条（仓外 doc/） | 每处带「2026-09-01 T67 随 T62/T65 同步」级注记；S1:111 全文档→当前页（冲突项必改）、S1 §6 三轴收两轴、S3 §2 setup 契约重钉（canvas 三态）等 |
| 孤儿文件删除 | `src/app/ai/pi-backend/prompts/system-prompt-marketing.md`（git rm） | 主 agent 集成执行 |
| 引用清理 | `tools/rebuild/src/verify/t45-manifest-dump.mjs`、`spikes/probes/probe-t45-old-route.mjs` 复制清单去 marketing 文件 | 两脚本均不挂 CI/package.json（grep 实证）；t24 冒烟 WORKFLOW_MARKER 为内嵌常量不读文件，删除无影响（复跑绿） |
| 中断半成品处置 | 中断前对该文件的 -145 行改写已 git checkout 还原，抢救语义转入挖掘清单 | subagent 汇报 + git status 实证 |

## 3. 集成验收（主 agent 复核）

- 挖掘清单的 longform 目标项 **vs** T68 落地文：parent_id 必传 / JSX 不写 id / calc 承算术 / h="hug" / 占位命名 / describe 修尽 / brief 四区协议（素材三态 + look 触发条件 + 结论区 append-only）/ create_brief 纪律（逐字转录 + ambiguous 不建 + 不触发 setup_design）——逐项 grep 命中 longform.md:23/:30/:60/:62 等，吸收确认。
- base.md 候选项（四区协议本体、画布选区、Composition Primitives、双图路由）按挖掘清单登记在案、**不本次移栽**（W5 裁决面）——无丢失。

## 4. 门禁（集成后 unpiped 实录）

- `bun test ./tests/engine/rebuild` exit 0（380 pass / 0 fail）
- `bun run smoke:pi` exit 0（76 断言全绿，含 t24「C1 空槽不含旧 marketing 工作流段句式」删除后仍成立）
- `bun run lint` 0 / `typecheck` 0 / `format:check` 0（触碰的 2 个 .mjs 已 oxfmt --write）/ `check:zones` 0（零登记）/ `check:tasks` 0

## 5. 偏差登记

1. 调研 §3 S2 触点 :173/:176 实为验收锚 3/6 行（v3 修订行致行号漂移，语义命中）。
2. S4 §7 两条清单外悬挂尾巴（蓝图节布局、types 分裂形态）顺手归档并标注——属同一 type 删除面，接受。
3. 同构发现（另案 follow-up）：`prompts/system-prompt-base.md` 亦是孤儿（活体 = studio/base.md，t46-base-fidelity.mjs 零 diff 卡口维持同步）——退役涉及 T46 门禁存废，本任务不动。
