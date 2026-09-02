# T86-plan · editable-design-full 高保真移植（owner 复盘裁决）

## 背景与定谳

owner 复盘 T85 移植：`editable-design.md`（182 行）改写幅度过大、大量借 longform 腔
（CP 编号/阶段工具白名单等均为本仓自创结构），且效果未验证。裁决：**新增一个高保真
移植版 mode，与原改写版并存供效果对比，只做机制必需的改写，正文零内部概念泄露**。

### 定谳 1：新增 `editable-design-full`，不动旧版

- id `editable-design-full`，label `海报设计（完整流程）`，step_budget 50，
  sizes 与旧版一致（竖版海报 794x1123 + 方形社交卡片 1080x1080）。
- 旧 `editable-design.md` 一个字不动（对比组）。modes 钉扎变 4 个：
  `[general, editable-design, editable-design-full, longform]`（字典序）。

### 定谳 2：正文语言 = 英文，逐字保真最大化

原 SKILL.md（605 行）是英文；base.md 已有英文先例。改写策略 = 逐节过原文，
**能逐字保留就逐字保留**，只对机制不存在的句子做最小替换。替换规则表：

| 原概念 | 替换为 |
|---|---|
| index.html / HTML / CSS / live HTML text | render 工具 JSX / 真 Text 节点 / 节点属性 |
| scripts/*.sh、mjs（init/trace/render/check/wire/build-replay/font-kit） | 对应工具调用或删除 |
| Chrome / 浏览器渲染 / PNG 渲染管线 | look（像素验收）+ describe（结构审计） |
| brief.md 逐字 / design-plan.md / asset-plan.json / prompts.md / render-review.md / P01-P18 证据标签 | brief 结论区 append-only 记录（append_brief_conclusion） |
| editor.html / layers.html / replay/ / PPTX / 脚手架清理 | 删（原生编辑器覆盖，无载体） |
| 图片批量「≤10 并发一批、all-settled」 | 单次 generate_image `requests` 批量（编排器并行 + 逐条落账，语义等价） |

### 定谳 3：删除段清单（机制性删除，非缩水）

- Choose the execution path（one-shot/capability 分流的全部分流条件都绑定 HTML 管线）
- Build the default editing contract 的 editor.html 特性枚举 → 改写为「为编辑而建」
  一小段（语义命名节点/成组/真 Text/不拍扁可动单元——原生编辑器是默认编辑契约）
- Deliver the standalone layer breakdown / Clear the scaffolding / Optional PPTX handoff

### 定谳 4：机制补充最小集（原文没有、本运行时必需）

正文尾部一个短节（全用模型可见术语，无内部概念）：

1. ask_user_question 表单语义：发问即终止回合；作答/跳过经下一条用户消息回来；
   跳过 = 自由文本意图，按内容续跑，不重发同一表单。
2. brief 四区协议紧凑版（内容区绑定 / 素材区三态 / 结论区 append-only / 关联设计区只读）——
   base.md 零 brief 覆盖（grep 实证），本文件必须自带。
3. 画布选区 `[画布选区]` 块 + UI 已确认的新建参数锁定（一句）。
4. 步数预算与续跑：无隐藏回合状态；续跑 = read_brief + describe/look 验画布
   （画布实物优先）+ 历史查未答表单；预算不足收尾协议。
5. read_reference 用法一句（「按需参考」节列出，用到才读）。

### 定谳 5：泄露纪律

正文禁词：frontmatter / runState / 宿主 / T\d+ 任务号 / S\d 规格号 / 仓库源码路径 /
assembleTurn 等装配机制词。例外（模型可见接口）：工具名、字体注册表（font registry，
font-system.md 同款先例）、UI/编辑器可见行为。验收含全文件 grep 零命中。

### 定谳 6：references 复制共享

references 解析基 = `workflows/<id>/references/`（registry.ts 头注实证），`..` 被拒
不能跨目录共享 → 复制 T85 已适配（且已过泄露清扫）的 4 份到
`workflows/editable-design-full/references/`。评估期双份并存可接受；owner 二选一后
随退役那份一起删。jscpd 只扫 TS，md 重复不触门禁。

## 验收标准

1. 逐节映射自检表（原 605 行每一节 → 保留/适配/删除 + 理由）进 self-check。
2. 泄露 grep（定谳 5 词表）全文件零命中。
3. `bun test tests/engine/rebuild/studio tests/engine/rebuild/pi-backend` 全绿
   （builtin-assets modes 钉扎更新 + 新版注册断言）。
4. `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` 全绿（modes 断言 3→4）。
5. 七门禁（lint/tsgo/check:vue/format:check/check:zones/check:i18n/check:docs）全绿。
6. 独立核验（code-reviewer subagent）：保真度抽查 + 泄露扫描 + 机制正确性。

## 不做

- 不动旧 editable-design.md 与其 references。
- 不改父仓契约文档（机制零变化，纯内容新增）。
- 不做 Seedream 透明资产降级行、批量波次帽（旧版文本小修 + 加固项，另议）。
