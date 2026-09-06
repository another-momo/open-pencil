<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T48 核验 · watercolor_poster_v2 抢救性迁移 + T44 保真核验脚本修复

> **状态**：✅ 核验完成——通过带 findings（F1-F4 全部处置在案） | **时间**：2026-08-31 核验执行 / 2026-08-31 findings 收口 | **核验人**：subagent（独立核验）+ 主 agent（findings 处置）
> **关联**：[T48-plan.md](T48-plan.md)（验收标准 C1-C6）/ [T48-self-check.md](T48-self-check.md)

## 总判定

**通过带 findings**——C1-C6 全部独立复核 PASS；主动找茬发现 1 条 P2（F1，smoke:pi live 车道被 3→4 变更打破）+ 3 条 P3，收口段全部处置完毕并复验绿。

**核验过程污染事件（如实记录）**：subagent 核验期间对全仓执行了写模式格式化（239 个无关文件被改写、其「终态干净」声明不实），主 agent 全量回退后在干净树上以最小 diff 重放收口编辑——详见 T48-self-check §3 修正记录 7。本报告 V1-V7 的核验结论以 subagent 复核证据为准（其只读核验动作有效），findings 处置与复验在回退后的干净树上完成。

## 逐项结果（subagent 独立核验，2026-08-31）

- **V1（C1 保真）PASS**：`node tools/rebuild/src/verify/t48-v2-rescue-fidelity.mjs` → 9/9 PASS（exit 0）。核验方另做零信任字节级重建：git 钉扎源取 v2 markdown → 应用 RENAME → 拼 frontmatter，与仓内文件 diff 唯一差异 = oxfmt 补的 `## Tone` 前结构性空行（50a51，自检修正记录 2 声明属实）；Recipe 节为真配方（generate_image/compose_backdrop/look 四步）逐字，非 no-op；节名归一恰好四处，frontmatter 四键 + applicable_to 收窄 [longform] 与 D-a 登记一致。
- **V2（C2 T44 卡口）PASS**：`node tools/rebuild/src/verify/t44-migration-fidelity.mjs` → 21/21 PASS；源读取 = `git show 4ce51816:…`（commit 钉扎，verify-t44-migration-fidelity.mjs:63 附近）；`git rev-parse` 双 ref 同 blob `ec9b22a3`。
- **V3（C3 注册与投影）PASS**：`bun test tests/engine/rebuild/` → 26/26；`node tools/rebuild/src/verify/t45-manifest-dump.mjs` 实跑 profiles 四份齐含 v2、泄漏 CLEAN；dump 输出 failures 的 base.md 缺失一条确认为 fixture 历史形态（自检 §3.3），非缺陷。
- **V4（C4 门禁）PASS**：format:check / lint（0 错误 5 警告基线）/ check:zones / check:docs（42/42）/ check:bindings / check:tasks 抽查 exit 0（直读退出码无管道吞码）；核验方补跑 tsgo / check:vue / check:i18n 亦全 0——九项门禁声明完整成立。
- **V5（C5 回归裁决复查）PASS**：仓外 log 尾部实测 2562 pass / 76 fail / 2661（562.01s）；t48-failures.txt（71 条）对照 t47（72 条）唯一变化 = 少 `MCP stdio transport > stderr does not contain JSON-RPC`（既有 flake 未复现），零新增；对 t48 清单 grep `studio|profile|rebuild|watercolor|pi-backend|manifest` 零命中——裁决独立成立。
- **V6（C6 登记面）PASS**：tracker.md / _index.md 的 T48 行三件套列均为有效链接且物理存在；T44 三件套各有「⚠ 当前态修正（T48，2026-08-31）」指针行。
- **V7（缺陷面）**：a) manifest.ts:62 投影 `.filter((p) => !p.deprecated)`，v2 无 deprecated 键 → 正常进数据面，PASS；b) 两脚本 git 依赖经 F4 补声明后成立，PASS；c) oxfmt canonical 声明经字节级重建证实，PASS；d) 主动发现 = F1-F4。

## Findings 与处置（收口段，2026-08-31）

- **F1（P2）`prompt-assembly-smoke.mjs:233` 断言 `profiles.length === 3` 被 3→4 打破**——T45 遗留钉扎，挂 live 车道 `bun run smoke:pi`，实跑 29 passed / 1 failed 取证。与 verify-t44 同类的「3→4 连带伤口」、实现段自检漏登记。**处置**：断言改 4 + 标签「四精品」+ 增补 v2 成员断言（id/label/applicableTo）；处置后复跑 `node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` → **30/30 PASS**。
- **F2（P3）dump 脚本覆写非 canonical json（C3→C4 自踩）**——存量形态（T45 起）。**处置**：docstring 补「跑完须 `bunx oxfmt --write` 该 json 再过 format:check」警告（verify-t45-manifest-dump.mjs 头注）。
- **F3（P3）`mode-overlay-bind-smoke.mjs` 「三精品」措辞陈旧**（成员制断言不受 3→4 影响）。**处置**：docstring 与断言标签改「四精品」并补 `水彩海报 v2` 选项成员断言（UI 车道 `smoke:pi:ui` 形状不变，仅文案 + 一个 count 断言）。
- **F4（P3）两保真脚本 docstring 未明文 git 前置**。**处置**：两脚本头注各补「前置：PATH 上需有 git（缺 git 响亮 ENOENT，非静默）」。

findings 处置后复验（干净树最小 diff 重放后）：`node tools/rebuild/src/verify/t48-v2-rescue-fidelity.mjs` 9/9、`node tools/rebuild/src/verify/t44-migration-fidelity.mjs` 21/21、T24 冒烟 30/30、format:check exit 0（均 2026-08-31）。
