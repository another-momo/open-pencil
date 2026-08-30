<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T43 核验 · studio 资产文件机制内核（S4 W1 / T-A1）

> **状态**：✅ 核验完成——可以收口 | **时间**：2026-08-30 核验执行 | **核验人**：subagent（独立核验，只读+运行命令，未改仓库文件）
> **关联**：[T43-plan.md](T43-plan.md)（验收标准 C1-C8）/ [T43-self-check.md](T43-self-check.md)

---

## 总结论

**可以收口。** V1-V5、V7 全过；V6 挖出 6 条观察项（均为设计意图或后续任务收紧点，无一构成打回理由），观察项 (a)(d)(g) 已记入 S4 §7 尾巴表。

## V1 计划-实现一致性：✅ 过

- 实现覆盖 plan §3 S1-S5：studio/ 五件（types 87 行 / parse 106 / validate 313 / registry 277 / index 21）+ studio-registry.test.ts（419 行，16 用例）；S6 回写件（01-target-state.md / tracker.md / tasks/_index.md / records/narrative/01-target-state.md）均在 diff 中。
- §5「不做」清单遵守：`git diff 83a9687d..HEAD --stat` 改动面内无 config.yaml 迁移、无 manifest 端点、无 UI 改动（`--name-only | grep -E "brand/|manifest|server|\.vue|components/"` 零命中）；`find studio -name "*.md"` 为空（无占位资产，PD-16 遵守）；`fs.watch` 仅出现在注释。
- 实测修正（id kebab/snake 双收、size HUG 形态）已回写 plan D-d 与 self-check §3.4，非暗改。

## V2 规格一致性（对照 S2）：✅ 过

- §2 布局与覆盖：`registry.ts:28-29` 两源路径；`collectCandidates`（:50-62）builtin→user 同 id 覆盖；general 恒在（:219-220 + :215 knownModeIds）。
- §4 workflow：types 必填/`none`（validate.ts:123-129）；size 双形态 `/^\d+x\d*$/`（:59,:93-101）；同名蓝图节存在且非空（:147-157）；step_budget 正整数（:167-178）；`types: dir:...` 拒绝且 hint 注明 PD-17 预留（:160-164）。
- §5 profile：五必需节字面一致（:184-190）；空节失败/no-op 通过（:245-257）；applicable_to 含 general（:259-277）；hex 启发式（:198-210）；字体白名单 `fontRegistryEntry` 真实命中 core 注册表（:286-293）。
- §8 失败暴露：单文件失败不注册 + failures 带 path/kind/reason/hint、其余文件可用；整体缺失态 kind:'studio'（registry.ts:230-237，探针实证空双目录触发）；用户目录不存在 = 正常态。

## V3 测试真实性：✅ 过

- `bun test tests/engine/rebuild/studio-registry.test.ts` → 16 pass / 0 fail / 62 expect()（2026-08-30 复跑）。
- 仓外临时探针（11 断言全 OK）独立复验：未初始化 getStudioRegistry 抛错；缺 types → 不注册+failure 指名；负向对照（好 fixture → 0 failure，证明断言非恒真）；未知 mode 指名/general 合法；`#a0c4e` 报 / `#1`+`#fff` 不误报。

## V4 门禁：✅ 过

- `bunx tsgo --noEmit` exit 0 零输出；`bunx oxlint -c oxlint.json --type-aware --type-check src/app/ai/pi-backend/studio/` 0/0；`bunx oxfmt --check` 全过（7 files）。

## V5 回归：✅ 过

- `bun test tests/engine/mcp/server/index.test.ts` 独立复跑 22/22 绿——「MCP 并发 flake」定谳成立。
- `bun test tests/engine/rebuild/` 19/19 绿。
- T42 基线复核：`doc/t42-quick-full.log`（仓外，524KB）150 行 `(fail)`，剥离计时尾缀唯一化 = 72 例（与 self-check 吻合；朴素 sort -u 得 73 是计时尾缀计数假象）；MCP 并发用例在基线日志中仅以 `(pass)` 出现 →「diff 仅 +1」声明自洽。

## V6 缺陷面挖掘：✅ 无阻塞缺陷（6 条观察项）

| # | 观察项 | 判定 |
|---|---|---|
| a | `listMarkdownFiles` 的 `.md` 后缀大小写敏感，`LONGFORM.MD` 静默忽略（不注册也无 failure） | 后续收紧点 → 已记 S4 §7 尾巴表 |
| b | CRLF 全程容忍（trim/`\s*$` 吞 `\r`；探针实证 CRLF 文件注册成功）；同名节首现生效 | 设计事实，无需动作 |
| c | 用户目录坏文件掩盖内置同 id 好文件（failure 指用户路径+指引） | 设计意图（S2 §2 覆盖语义 + §8 显式暴露已满足） |
| d | base 不走 validateCommon，label 不校验（S2 §3 未定义 base schema） | 与契约一致；T-A5 落位时如需再收紧 → 已记 S4 §7 尾巴表 |
| e | 平铺索引使二级节 `## foo` 也能满足 type 蓝图节（不强制位于 `## type 蓝图` 下） | 与 S2 §4 字面一致（「同名正文节」），plan §3 S2 已登记口径 |
| f | hex 启发式 7 位混合 `#ff00gg0` 漏报 | 已声明「宁可漏报不可误报」（validate.ts 注释） |
| g | 单测 C5 行内注释「空目录→只有 base 缺失一条」不准确（实测空双目录产生 2 条：base 缺失 + studio 整体态） | 注释修正随收口 commit 落地（无断言依赖该注释） |

## V7 文档一致性：✅ 过

- `packages/core/src/text/fonts.ts:27` re-export `fontRegistryEntry` 逐字属实（源函数 registry.ts:146）；plan §1 import 先例（tools.ts:37 / host.ts:33 / attach.ts:15）属实；`"yaml": "^2.9.0"`（package.json:129）属实。
- tracker.md:54 T43 行 / tasks/_index.md:77 T43 行 / 01-target-state.md Phase 3 回写均实证存在；`check:tasks`/`check:bindings` 复跑绿。
