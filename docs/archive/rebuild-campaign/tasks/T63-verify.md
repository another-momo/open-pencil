<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T63 核验 · CI 第四轮修复：上游 i18n 重构 GHOST 双件合规化

> **状态**：✅ 已完成（2026-09-01 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T63-plan.md §1/§3/§4 + check.ts GHOST/tarball 规则源码；实现为工作树未提交态（`git status` 2026-09-01）

## 1. 核验范围

tools/zone-registry/zones.json 的 `upstreamMergeTarball` 新条目（task T63）、两个 dialogs 文件的 byte 一致性与 importer 依赖事实、上游删除窗口证据、GHOST 规则豁免语义、波纹门禁（check:docs / format:check / lint）、工作树净度。CI 复绿（plan §3 第 3 条）需 push 后观测，超出本核验授权（只读 + 禁 push），见 §3。

## 2. 验收核验（V 逐条，2026-09-01 实测）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | `bun run check:zones` exit 0（unpiped 直读退出码） | ✅ | `bun run check:zones; echo EXIT_CODE=$?` → 输出 `[zones] clean: 81 modified (all registered), 481 added (owned), 1019 deleted (all registered), 0 renamed (cross-checked), base 88c10770`，EXIT_CODE=0（与 CI 同口径：本地上游引用已含 be942783，见 V5） |
| V2 | zones.json tarball 条目结构合规 | ✅ | 结构化 JSON.parse（bun -e）实测：`upstreamMergeTarball` 数组 len 2，entry[1] = `{base:"88c1077071328b8df68f282543f16e20e97930b4", task:"T63", lastReviewed:"2026-09-01", paths:["packages/vue/src/i18n/locales/zh-cn/dialogs.json","packages/vue/src/i18n/messages/dialogs.ts"]}`——task/base/两 paths 精确命中；`grep -n "P138\|P139" zones.json` 无匹配（exit 1，patch 形态已清除）；93 条 patches 扫描无一触及两路径；JSON 合法解析；`git cat-file -e 88c1077071328b8df68f282543f16e20e97930b4` 成功（type commit，base 本地可达） |
| V3 | 两文件与 base 字节一致（白名单承重前提） | ✅ | `git diff 88c1077071328b8df68f282543f16e20e97930b4 -- <path>` 两路径输出均空（exit 0）；blob hash 双重钉扎：messages/dialogs.ts 工作树=base=`8ce70e35e816a593b6a27ac009d109dd3a55d10b`，locales/zh-cn/dialogs.json 工作树=base=`1c0b1c06bd05c6329c77d9376ad4dc8986e84f34`——同时满足 T32 L4 tarball drift 门禁 |
| V4 | importer-dependent 事实 | ✅ | `grep -n "dialogs" packages/vue/src/i18n/messages.ts` → :2 `import { dialogMessageDefaults } from '#vue/i18n/messages/dialogs'`、:18 再导出 `dialogMessages, dialogMessageDefaults`、:27 使用；`grep -n "dialogs" packages/vue/src/i18n/locales/zh-cn/index.ts` → :4 `import dialogs from './dialogs.json'`、:18 使用——两文件删除不可行成立 |
| V5 | 上游删除窗口证据 | ✅ | `git merge-base --is-ancestor be942783 upstream/master` exit 0，且 upstream/master HEAD 即 be942783（`refactor(i18n): migrate app copy to domain namespaces`）；`git log --diff-filter=D --name-only --pretty=format: 88c10770..upstream/master -- packages/vue/src/i18n/` 列出删除含 `messages/dialogs.ts` 与 `locales/zh-cn/dialogs.json`（另 7 个其他 locale 的 dialogs.json 同删，本地未持有/已登记，check:zones 通过佐证） |
| V6 | GHOST 规则 tarball 豁免语义 | ✅ | check.ts:208-251 checkGhostDeleted：:239 `const tarballPaths = new Set((zones.upstreamMergeTarball ?? []).flatMap((t) => t.paths))`、:246 `.filter((p) => !tarballPaths.has(p))`——tarball.paths 成员直接豁免 GHOST；:232-234 注释明示豁免面三态（owned/patch/tarball.paths）与 04-porting-discipline §5 对齐 |
| V7 | 波纹门禁不回退 | ✅ | `bun run check:docs` exit 0（42/42 通过）；`bun run format:check` exit 0（"All matched files use the correct format"，2148 文件，tools/ 在 oxfmt 范围内 → zones.json oxfmt-clean）；`bun run lint` exit 0（0 errors；7+6 条 max-lines warning 均为既有文件，与 T63 文件面无关） |
| V8 | 工作树净度 + 红线（两 dialogs 文件一字节不动） | ✅ | `git status --porcelain`：M docs/rebuild/tasks/_index.md、M docs/rebuild/tracker.md、M tools/zone-registry/zones.json、?? T63-plan.md、?? T63-self-check.md、?? T63-verify.md（本文）——全在预期面内，无散落临时文件；`git status --porcelain -- packages/vue/src/i18n/` 输出为空，两 dialogs 文件零改动；tracker/_index 各 +2 行且均为 T63 叙事（git diff 实测） |

**附验（plan §3 第 2 条后半）**：`bun run check:tasks --base ef3981a279fd1a22d16b8f803698724326c1d06a`（= b27bf192^，前次 push 前 SHA）exit 0——zones.json 变更的 task 指针链完整。

## 3. 边界与未核项

- **CI 复绿（plan §3 第 3 条）**：需 push 后由 CI 实测，本核验 agent 授权为只读 + 禁 push，未核。【未核】收口动作（提交 + push）后须观测 Rebuild discipline / Zone registry purity 转绿。
- 自检 C2 记录「479 added」与本核验 V1 实测「481 added」差 2——为自检后新增的 T63-self-check.md / T63-verify.md 落入 owned 计数所致，退出码语义不变，非回退。
- check:tasks 输出将本次变更归属 HEAD 提交任务（T56）属门禁既有行为（按提交指针归因）；zones.json 内的 task: T63 指针由 V2 钉扎，不受影响。

## 4. 总结论

**可以收口**（V1-V8 全绿 + plan §3 第 1/2 条实测通过；第 3 条 CI 复绿待 push 后观测——见 §3 首条）。
