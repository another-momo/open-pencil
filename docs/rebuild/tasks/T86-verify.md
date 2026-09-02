# T86-verify · editable-design-full 高保真移植——独立核验（code-reviewer subagent）

核验对象：`studio/workflows/editable-design-full.md`（522 行新增）+ 4 份 references 复制 +
两处 modes 钉扎更新。对照原文 `参考项目/Editable-Design/skills/editable-design/SKILL.md`
（605 行）。核验日期 2026-09-03。

| 项 | 结论 | 证据摘要 |
|---|---|---|
| A 保真度抽查（5 段自称逐字保留） | ✅ PASS | Communicate clearly / 参考四值 / art-directed 三边界 / 拓扑五型 / 审阅清单逐句对比——仅授权机制替换（HTML→real text nodes / vector geometry / font registry / 节点语义），无设计纪律丢失、无自称保留被擅改的句子 |
| B 删除合理性（4 段） | ✅ PASS | execution path 分流 / editor.html 契约 / layers+scaffolding / PPTX 均无本仓载体（find editor.html/layers.html/html-to-pptx/render-poster.sh 全空）；设计价值并入 Build for editing + Add only what this poster needs |
| C 机制正确性 | ✅ PASS | frontmatter 过 validate.ts workflow 校验口径；references 4 条与磁盘布局吻合（解析基 workflows/<id>/references/）；14 个工具名 grep 实证存在；Runtime mechanics 表单/brief 措辞与 longform.md L23/L88-92 一致 |
| D 泄露扫描 | ✅ PASS | 13 个禁词 grep 零命中；保留词 font registry 5 处 + host 1 处确为模型可见语义（plan 定谳 5 允许） |
| E 钉扎更新 | ✅ PASS | builtin-assets 1/1（36 expects）+ t24 冒烟 25/25 复跑实证；modes 序 `[general, editable-design-full, editable-design, longform]` 与文件名序（'-'(0x2D) < '.'(0x2E)）契合 |
| F 新旧版一致性 | ✅ PASS | 两版 references 4 份 byte-identical（diff -r 零输出）；批量纪律互相一致无矛盾 |

**总评：PASS（6/6），无阻断项。** 两点如实声明：① editable-design-full 在 mode 选择器
排在 editable-design 前（文件名序副作用，仅展示序）；② references 双份并存为评估期
临时态，owner 二选一时随退役一份清理。
