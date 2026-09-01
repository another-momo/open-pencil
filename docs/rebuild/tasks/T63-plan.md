<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T63 计划 · CI 第四轮修复：上游 i18n 重构 GHOST 双件合规化

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 核验 subagent
> **触发**：CI run 33460844556（T53/T56/T57 push）Rebuild discipline / Zone registry purity 红——2 条 GHOST

## 1. 背景与方案

上游 `be942783 refactor(i18n): migrate app copy to domain namespaces`（2026-08-31 19:02Z 合并，gh api 实测）删除 `packages/vue/src/i18n/messages/dialogs.ts` 与 `packages/vue/src/i18n/locales/zh-cn/dialogs.json`（dialogs 文案迁入 17 个新域名命名空间文件，gh api contents 实测）。check:zones 的 GHOST 规则（check.ts:204-249，T32 L3）扫描 `merge-base..upstream/master` 窗口内的上游删除——CI 现拉上游故窗口含 be942783，本地引用陈旧故 Wave 2 集成期未复现（base 漂移教训：门禁预演须先 fetch upstream）。

两文件**不能跟随删除**：`packages/vue/src/i18n/messages.ts:2,18` import dialogMessageDefaults/dialogMessages、`locales/zh-cn/index.ts:4,18` import dialogs.json（importer-dependent，grep 实测 2026-09-01）；采纳上游域名重构 = 下一轮 upstream 合并波的事（S4 §7 尾巴表登记）。

**落法**：两文件与 base 88c10770 字节一致（T35 还原在案；R-diff  phantom 规则实证拦 patch 形态）→ 按 check.ts:234 豁免面登记进 `upstreamMergeTarball` 白名单（新条目：base 88c10770 全 SHA + task T63 + 两 paths），不走 patch。

## 2. 不做清单

- 不采纳上游 i18n 域名重构（17 个新域名文件的合并属下一轮 upstream 波）。
- 不改 messages.ts / zh-cn/index.ts 的 import 结构（消依赖评估随合并波一起做）。
- CI 门禁分层改造（GHOST 窗口规则降级为雷达）= T64，owner 2026-09-01 已拍板，本任务不动 ci.yml。

## 3. 验收标准

1. `bun run check:zones` exit 0（本地上游引用已含 be942783，与 CI 同口径）。
2. zones.json 变更带 task 指针（tarball 条目 task: T63）；`bun run check:tasks --base <前次push前SHA>` 绿。
3. 九门禁其余项不回退；CI 复绿（Rebuild discipline 全 steps 过）。

## 4. 红线

- 只动 tools/zone-registry/zones.json 与 docs/rebuild/ 叙事面；两个 dialogs 文件本身一字节不动（R-drift 钉 byte 一致）。
