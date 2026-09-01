<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T63 自检 · CI 第四轮修复：上游 i18n 重构 GHOST 双件合规化

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 核验 subagent

## 1. 立项段自查（2026-09-01）

1. **失败实证**：CI run 33460844556，Rebuild discipline / Zone registry purity 红，2 条 GHOST（gh api jobs/logs 实测）；其余 12 job 全绿（含 Code quality / smoke:pi / 全部引擎测试）。
2. **根因定位**：GHOST 规则（check.ts:204-249，T32 L3）扫 `merge-base..upstream/master` 窗口的上游删除——CI 现拉上游（ci.yml:113-116）窗口含 be942783；本地引用陈旧（5689eccc）故集成期未复现。fetch 重试四轮后成功（github.com 连接间歇性超时，gh api 走 api.github.com 不受影响），本地复现 4 违规（2 GHOST + 2 调试临时文件——已删）。
3. **删除不可行**：messages.ts:2,18 / locales/zh-cn/index.ts:4,18 仍 import 两件（grep 实测）；GHOST 提示的「register a patch if importer-dependent」为正路。

## 2. 实现段核验（2026-09-01 实测填报）

- **C1 登记形态修正**：先试 patch（P138/P139）→ R-diff 拦「byte-identical to base = phantom patch」（两件均与 base 88c10770 字节一致，T35 还原在案）→ 改 tarball 白名单（check.ts:234 豁免面明示三者之一）——新条目 `{base: 88c10770 全 SHA, task: T63, lastReviewed: 2026-09-01, paths: [zh-cn/dialogs.json, messages/dialogs.ts]}`。
- **C2 复绿实证**：`bun run check:zones` exit 0（本地上游引用已含 be942783，与 CI 同口径）——clean: 81 modified / 481 added / 1019 deleted。
- **C3 教训反哺**：① zones 门禁预演前须 `git fetch upstream master`（base 漂移 = 本地绿 CI 红的新类别，T50-T51 的「CI 步骤序掩盖」之后第二类）；② zones.json 文本编辑后必跑 oxfmt（断言式文本替换被 oxfmt 重排打断一次，改结构化 JSON 操作落定）。

## 3. 实测修正记录

1. patch → tarball 的形态修正（见 C1）——「保留且 byte 一致」的合规载体是 tarball 白名单而非 patch；04-porting-discipline §5 三态语义自此有实例支撑。
2. 调试临时文件（ci-jobs.tmp.json/ci-jobs.err/ci-job.log）落仓根触发 ADDED outside ownedRoots——已删；教训：CI 日志落仓外或 /tmp。
