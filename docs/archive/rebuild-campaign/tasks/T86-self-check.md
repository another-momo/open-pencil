# T86-self-check · editable-design-full 高保真移植

依据 T86-plan §验收标准 逐条自检。

## 1. 逐节映射自检表（原 SKILL.md 605 行 → editable-design-full.md 522 行）

| 原节 | 处理 | 说明 |
|---|---|---|
| frontmatter（name/description） | 适配 | 转本仓 schema（id/label/subtitle/step_budget/sizes/references）；description 的用途/禁域语义进 intro 段 |
| # Editable Design intro（交付物定义） | 适配 | HTML/PNG/replay 交付物 → 画布原生节点 + brief 结论区证据链；「Do not use for websites…」保留 |
| ## Communicate clearly | **逐字保留** | 仅追加一句表单载体指针（ask_user_question → Runtime mechanics） |
| ## Choose the execution path | **删除** | 分流四条判定全绑定 HTML 管线（空 workspace / 屏幕分辨率渲染），无载体 |
| ## Generate the imagery 总则 | 逐字保留 | 「CSS shapes」→「vector geometry」；Lucide 段改 `<Icon name="lucide:…">`（render 内联）；追加 generate_image/stock_photo 双工具路由一段（来自改写版通用纪律，机制必需） |
| ### Choose the reference mode（四值） | 逐字保留 | 「live typography, HTML geometry, local icons」→「live typography, vector geometry, icons」 |
| ### Create an art-directed composition reference | 逐字保留 | 三边界全保留；「save under reference/」→「生成为设计框外独立节点」；P02/composition-prompt.md → 结论区记录；look 读参考 |
| ### High-fidelity reproduction | 逐字保留 | 「script face that is not installed」→「not in the font registry」 |
| ### Choose the asset architecture before prompting | 逐字保留 | 五型拓扑完整；asset-plan.json → 结论区资产计划；reference 链接改 read_reference 路径写法 |
| ### Prompt the shipping assets | 适配 | 批量段改 requests 单次批量契约（并发 + 逐条落账，all-settled 语义等价，无 10/批波次帽）；import.sh → describe+look 一次过查验；重试纪律逐字 |
| ## Start new posters immediately | 适配 | 同题冲突检查保留（载体 ask_user_question）；init-poster.sh → create_brief 逐字 + setup_design；「不抄 ambient state」逐字；浏览器打开 starter 删；新增「UI 已确认参数锁定」一句（机制必需） |
| ## One-shot build 15 步 | 适配为 9 步「The build sequence」 | 设计相关步全保留（读 brief / 定画布 / 参考先行 / 一体化决策 / 批量生成 / 一次版式 / 字族检查 / 修尽 error / 审阅闭环）；脚本步（脚手架清理/check-poster/check-contract/render-poster/wire-editor/verify/replay）删除或并入 describe+look；增补两条本仓机制行（40+ 元素拆调用、裁剪不拉伸——与改写版阶段 3 一致的真实工具约束） |
| ## Record the creative path without constraining it | 适配 | Replay 七段视图 → 结论区证据链；「不从记忆重建/不加通用评论/缺席即缺席」逐字 |
| Capability path · Project setup | 并入 | 同题冲突与新建流已在上游节；「copy change is only a copy change」语义由修改路由惯例承载（本版未单设修改路由节——见偏差 4） |
| Capability path · Shape the poster | 逐字保留 | 仅 CJK 竖排的 CSS 机制句（white-space/flex/text-align）改写为节点语义；editor palette 对照句删（editor.html 概念） |
| Capability path · Build the default editing contract | 改写为「Build for editing」 | editor.html 特性枚举无载体；保留设计侧契约：语义命名 / 成组 / 真 Text / 不拍扁可动单元 |
| Capability path · layer breakdown / scaffolding / PPTX | **删除** | 无载体（layers.html、starter 脚手架、html-to-pptx 均不存在） |
| Capability path · Add only what this poster needs | 适配 | 三条 references 阅读纪律保留；印刷 96px/inch 保留；「无交互/CDN」保留为「编辑器即唯一交互层」 |
| ## Read the render | 逐字保留 | 标题改「Review the result」；清单八条全保留（含占位文案/载体像素比对/两轮诊断错改假设）；render-review.md → 结论区；补两条本仓机制化的修复动作（重生带字图 / set_text+set_text_resize——与改写版审阅清单一致） |
| ## Optional PPTX handoff | **删除** | 无载体 |
| ## Deliver | 适配 | 五文件标签段删；画布尺寸/字体族/逐行朗读/缺陷直说/障碍点名/内部概念不上话术 全保留 |
| （新增）## Runtime mechanics | 新增最小集 | 表单语义（终止回合/作答/跳过）+ brief 四区紧凑版 + 画布选区 + 预算与续跑 + read_reference 用法——全部模型可见术语，零内部概念 |

## 2. 泄露 grep（plan 定谳 5 词表）

`frontmatter|front-matter|runstate|run state|宿主|assembleTurn|TurnAssembly|pi-backend|before_agent_start|src/app|packages/core`（大小写不敏感）+ `T\d{2}|S\d §|拍板` —— **全文件零命中**（门禁输出见上）。
保留的合法词：font registry（font-system.md 同款先例）、`host`（原文原句 "even when the host exposes no formal setting"，指宿主应用有无设置项，模型可见语义）。

## 3. 测试与冒烟

- `bun test tests/engine/rebuild/studio tests/engine/rebuild/pi-backend`：**89/89 绿**（332 expects）。
- `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs`：**25/25 绿**（modes 断言更新为 4 个）。

## 4. 七门禁

lint 0 错（7 条 pre-existing max-lines 警告）/ tsgo 0 / check:vue 0 / format:check 通过 /
check:zones clean（新 md 文件被 workflows ownedRoot 自动收容）/ check:i18n in sync /
check:docs 44/44。

## 偏差列表

1. **modes 顺序与 plan 定谳 1 相反**：plan 写 `[general, editable-design, editable-design-full, longform]`，
   实测注册表按文件名字典序——`'-'(0x2D) < '.'(0x2E)`，`editable-design-full.md` 排在
   `editable-design.md` **前面**，实际 `[general, editable-design-full, editable-design, longform]`。
   两处钉扎按实序更新（builtin-assets.test.ts / t24 冒烟，注释注明原因）。
   **UX 后果：完整流程版在 mode 选择器里排在改写版之前**——纯展示序，owner 评估后
   二选一时随退役一起定。
2. oxfmt 对 editable-design-full.md 有幂等重排（表格/空白），内容零变化。
3. 原文「One-shot build / Capability path」双轨合并为单条 build 序列——分流判定全绑定
   HTML 管线属机制性删除，但「capability path」的 Project setup/Shape the poster 等
   设计内容全部保留并入了单轨。
4. 未单设「修改请求路由」节（改写版有）：原文续作语义散见于 Start new posters 冲突检查与
   reference mode 的 off 解析，高保真原则下不新造结构；续跑机制由 Runtime mechanics 的
   resume 段承载。
5. references 为 T85 已适配 4 份的**原样复制**（含泄露清扫后的措辞）；双份并存期间
   两处修改需同步——评估期临时态，owner 二选一后随退役清理。
