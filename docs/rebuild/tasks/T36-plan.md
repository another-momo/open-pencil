<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T36 计划 · T31/T34 合并质量整改

> **状态**：执行中 | **时间**：2026-08-28 | **负责人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（pi 线，自 T35 收口 HEAD 继续）
> **基线**：`3f85a3e9`（T35 收口后 HEAD）；zone 基线 = `88c10770`（merge-base HEAD upstream/master，2026-08-28 实测）

## 1. 背景与立项

T34 用真实 git merge（`c65d56e1`，parents = `36ad5c17` + `88c10770`）收口第三轮上游合并时，**静默反转了 T31 内容裁定的四条「维持删除」裁定**——git merge 语义把 88c10770 树的全部内容带进仓，T31 裁掉的 diagnostics（5f8a373b）/ portless（0f981ff2）/ changelog（a0a71c34）/ cli import（88c10770）四块无冲突面自动落地，无人登记。连带产物：

- diagnostics/usage 外壳在仓内但 chat 级事件未接线（usage 面板空数据）；
- Settings 的 mcp 僵尸 nav 复活（base 88c10770 含 5f8a373b 的 nav button，T25 切除的面板没回来——点击 nav 落 Storage 兜底）；
- `src/app/settings/dialog.ts` 的 `'mcp'` 成员复活，P45 成幻影 patch（与 base 字节一致，`git diff --quiet 88c10770 -- src/app/settings/dialog.ts` exit 0，2026-08-28 实测）；
- zones.json 另有一批登记错位：P8 双重记账（目标文件已在 deletedPaths）、P60/P61 幻影（与 base 字节一致，T32 迁移漏网，`git diff --quiet` 实测 exit 0）、P74 理由误记（实为 T31 eslint-complexity helper 抽取重构，`src/app/editor/clipboard/system.ts` L97-98 有注记）、P98-P102 双重记账（5 文件已在 ownedFiles）；
- `tests/e2e/settings/credentials.spec.ts` 残留五处 mcp 僵尸断言（L43/44/65/83/91/105，指向已删 UI 面，`git grep settings-section-mcp` 2026-08-28 实测）。

## 2. owner 拍板登记（2026-08-28，本任务的决策依据）

| 编号 | 拍板内容 | 拍板人/日期 |
|---|---|---|
| D-拍板① | diagnostics/usage 外壳**追认合入**（对 T31「不采纳」裁定的正式反转登记）+ T36 内完成 **chat 级接线**（`recordChatCompleted`/`recordChatFailed` 接入 fork 版 `src/app/ai/chat/transports.ts`）；**token 级**（`recordModelStepCompleted` 经 pi 后端采数）不在 T36 范围，登记排期 | owner，2026-08-28 |
| D-拍板② | changelog（a0a71c34）、cli import（88c10770）、portless（0f981ff2 vite 侧）三条静默反转**全部追认** | owner，2026-08-28 |
| D-拍板③ | Settings 的 mcp 僵尸 nav 删除——nav button、`SettingsSection` 的 `'mcp'` 成员一并清理；`SettingsDialog.vue` 裸 `v-else` 收窄为 `v-else-if storage` + 显式 fallback；`tests/e2e/settings/credentials.spec.ts` 五处 mcp 僵尸断言清理。i18n 键 `settingsMCP` **保留不删**（主 agent 评估：packages/vue 两文件 T35 已还原至与上游字节一致，删键会制造新 patch 徒增下轮合并冲突面，死文案无害——取舍注记进 P44 reason） | owner，2026-08-28 |
| D-拍板④ | check.ts 三条登记健康规则**直接判红**（先大扫除、后上线规则，同一任务内顺序执行） | owner，2026-08-28 |

## 3. 工作分解

### W1 · 登记大扫除

zones.json（每条改动在 `$comment` 按 P62-P82 先例记编号缺口/去向；每处 `lastReviewed` 刷 2026-08-28）：

1. **P8 删除**——目标 `src/app/ai/chat/storage.ts` 已删且在 deletedPaths，双重记账（实测 `ls` 不存在 + zones.json L612，2026-08-28）。
2. **P60、P61 删除**——两测试文件与 base 88c10770 字节一致，T32 迁移漏网（`git diff --quiet` 实测，2026-08-28）。
3. **P74 理由改写**——实际是「T31 eslint-complexity helper 抽取重构（`git diff --numstat 88c10770 -- src/app/editor/clipboard/system.ts` = 61+/47-，行为不变，system.ts L97-98 有注记）」，不是「上游合并快进」。
4. **P98-P102 从 patches 删除**——5 个对象是 fork 新建文件，已在 ownedFiles，双重记账且无 base 可补。
5. **P45 处置**——当前幻影 patch（dialog.ts 与 base 字节一致）。顺序约束：**先做 W2 代码改动（dialog.ts 删 `'mcp'` 成员）→ P45 改写为真实理由（「T36: SettingsSection 去 mcp 成员，owner 拍板③」）保留为活 patch → 最后跑 check:zones**。

文档状态不一致清理：

- `docs/rebuild/tracker.md`：§2 补 T35 行（口径与 [tasks/_index.md §2](../tasks/_index.md) L69 一致）+ T36 行（本任务）；T32 行笔误「AppButton.vue」改「AppTextButton.vue」并修正该行后半句自相矛盾处；头部时间刷新；§3.1 narrative 计数 15→16（`find docs/rebuild/records/narrative -type f | wc -l` = 16，2026-08-28 实测）。行预算 ≤80。
- `docs/rebuild/tasks/T35-verify.md`：头部状态 ❌→✅，追加「复验追记」（2026-08-28）：8ae675a6 占位清理后实测复跑（`grep -c "（待" T35-plan.md T35-self-check.md` = 0/0 exit 1，2026-08-28 复跑确认），诚实注明「复验工件此前缺失，本条为补记」。
- `docs/rebuild/tasks/T35-plan.md`：L12 状态「执行中」→完成态；§5 C1-C9 验收表刷新为实际结果。
- `docs/rebuild/records/narrative/tracker.md`：append-only 追加订正条目——此前「tracker.md §2 追加 T35 行」自述与实际 diff 不符，实为漏记，本次补上。
- `docs/rebuild/records/topics/ci-infra.md`：追加 T34 CI run 链（33051249610 failure → 33052623880 success → 33052862364 failure（Rebuild discipline base 语义）→ 33054175283/33054772651 success @ 29985845；五 run 均已经 `gh run view -R another-momo/open-pencil` 复验，2026-08-28）。
- 每个改动的 docs/rebuild 物理文件按 D14 同 commit 追加对应 `records/narrative/<file>.md` 条目。

### W2 · 代码整改

1. **chat 级接线**（`src/app/ai/chat/transports.ts`，P6）：`handleChatFinish`（:44-54）非 abort/error 分支接 `recordChatCompleted({ finishReason: finishReason ?? null })`；`onError`（:97-99）接 `recordChatFailed({ errorName: error instanceof Error ? error.name : 'unknown' })`；从 `@/app/diagnostics` import（`src/app/diagnostics/events/ai.ts` L39-47 已就绪）。接线语义参照上游 88c10770 版 transports.ts L150/L255（`git show 88c10770:src/app/ai/chat/transports.ts` 实测，2026-08-28），保持 fork 版结构（无 isDisconnect 参）。P6 reason 追记 T36 接线 + lastReviewed 刷新。usage 面板 token 列恒「Not reported」（`usageNotReported`，packages/vue/src/i18n/messages/dialogs.ts L201）属预期——token 级排期，后果写入 records/topics/upstream-merge.md 追认条目。
2. **mcp nav 清除**（owner 拍板③）：`src/components/settings/SettingsDialog.vue` 删 mcp nav button（L104-113）+ `<StorageSettingsPanel v-else />` 收窄为 `v-else-if="settingsDialogSection === 'storage'"` + 显式空态 fallback；`src/app/settings/dialog.ts` 删 `'mcp'` 成员；`tests/e2e/settings/credentials.spec.ts` 两个 mcp 测试（L37-75「MCP connections…」+ L77-116「MCP automation…」，五处僵尸断言的全部宿主）删除，其余三条测试保持完整。SettingsDialog.vue 挂既有 P44（reason 追记 T36、lastReviewed 刷新）；dialog.ts 的 P45 按 W1-5 处置；credentials.spec.ts 新增 P106（改后与 base 产生真实 diff）。
3. **接线实测**：跑 typecheck/lint/smoke:pi + 既有相关单测；若不新建专测则在 self-check 登记「人工实测缺口 + 建议排期」，不假报。

### W3 · 合并 SOP 12 条写入纪律文档

`docs/rebuild/04-porting-discipline.md` 新增「上游合并 SOP 清单（T36 增补）」一节，12 条（每条保留实证出处括注）：上轮裁定对账表 / modify-delete 冲突解前 `git show HEAD:<path>` 确认存在性 / nav→panel 路由完整链核对 + plan 断言引用具体文件行号版本 / merge 收尾固定 `bunx oxfmt --write` + `bun run format:check` / 外壳类功能逐 export grep 生产调用方 + 零调用方登记接线排期 / 合并后跑登记健康三规则（T36 机器化）/ 上游已删文件双向扫描 / merge 后 grep tests/e2e 指向已删 UI 面的 test-id / CI 红修复 commit 一律 `task: T<NN>` 抬头 + Rebuild discipline base=github.event.before 语义 / verify 核验项含断言级复核 + 上轮裁定维持/反转对账 / 当轮 CI run 链 append 进 records/topics/ci-infra.md / tarball 态纪律（仅无网应急 + 网络恢复后真 merge 收口 + merge-base 已超过 tarball.base 的记录归档）。

### W4 · check.ts 三条登记健康规则（直接判红）

`tools/zone-registry/src/check.ts` 新增三判定（错误信息风格与既有 violation 一致）：

- **R-exist**：每条非 revoked patch 的 file 必须在磁盘存在（杀 P8 类）。
- **R-diff**：每条非 revoked patch 的 file 相对 resolveBase 必须有 diff（杀 P45/P60/P61 类幻影/空挂）。tarball 记录内路径与 revoked 条目豁免；MERGE_HEAD 基线沿用 resolveBase 既有逻辑。
- **R-mutex**：非 revoked patches 的 file 不得与 ownedFiles/stubs/deletedPaths 重叠（杀 P98-P102 双重记账、P8 类）。

配套：`bun run check:zones` 全绿才算完成。tools/zone-registry 无既有测试（`ls tests/engine/rebuild/` 仅 i18n-seam.test.ts，2026-08-28 实测）——按任务书降级方案：self-check 里用「人为构造违规→实测判红→还原」的实测证据替代（真做并留命令输出）。

预检（2026-08-28，bun 脚本扫全部 67 条非 revoked patch）：违规全集 = P8（不存在+deletedPaths）/ P45、P60、P61（无 diff）/ P98-P102（ownedFiles 重叠）——与任务书口径一致，无额外意外。

## 4. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | zones.json 大扫除五项落地 + `$comment` 缺口注记 + lastReviewed 刷新，`bun run check:zones` 绿 | ⏸ 待开工 |
| C2 | transports.ts 接线 recordChatCompleted/recordChatFailed（语义对齐上游 L150/L255），typecheck/lint 绿 | ⏸ 待开工 |
| C3 | mcp nav/type/e2e 五处僵尸清除 + v-else 收窄 + fallback；i18n 键保留取舍注记入 P44 reason | ⏸ 待开工 |
| C4 | check.ts 三规则上线 + 人为构造违规实测判红证据（exit 1 + violation 文案）入 self-check | ⏸ 待开工 |
| C5 | 04-porting-discipline.md SOP 12 条落盘（每条带实证出处括注） | ⏸ 待开工 |
| C6 | records 追认：upstream-merge.md 追认条目（拍板①②③④ + 静默反转清单 + token 列后果）+ ci-infra.md T34 五 run 链 + narrative/tracker.md 订正条目 | ⏸ 待开工 |
| C7 | tracker.md 四项修正（T35 行 / T36 行 / T32 行笔误 / 计数 16）+ T35-verify/T35-plan 状态翻正 | ⏸ 待开工 |
| C8 | 门禁全套绿：check:zones / check:docs / check:bindings / check:tasks / typecheck / lint / format:check / smoke:pi（80 断言） | ⏸ 待开工 |
| C9 | subagent 独立核验「可以收口」（含断言级复核 + 上轮裁定对账核验项，SOP-10） | ⏸ 待开工 |
| C10 | 三件套齐 + 收口 SOP 五步全做（verify 状态翻转 / _index 行翻 ✅ / tracker 行翻 ✅ / plan 状态刷新 / narrative 绑定追加） | ⏸ 待开工 |

## 5. 出栈（明确不做）

- token 级 usage 接线（`recordModelStepCompleted` 经 pi 后端采数）——登记排期，见 records/topics/upstream-merge.md 追认条目；
- pendingReclass 重分类仪式；
- marketing prompt 裁剪 / 工具落地（C3a）；
- workbench CI 退役；
- tarball 退役检查自动化（W3-12 只立纪律，check.ts 不加退役判定）；
- e2e 真后端编排；
- git push（只 commit 不 push）；
- `credentials.spec.ts` 其余三条测试引用的旧模型面 test-id（`settings-add-model` / `provider-setup-open-settings` / `data-model-id` 等，`git grep` src/ 零命中，2026-08-28 实测）——同为 T25 删面残留但不在拍板③范围，登记为遗留问题候选（下轮 e2e 卫生任务处理）；
- tracker.md T34 行「octopus 8 commits（88c10770→0f981ff2）」拓扑描述失真（实测 `git log 0f981ff2..88c10770` = 7 commits 且 0f981ff2 为最老祖先，2026-08-28）——该 8 commit 清单实为 T31 合并区间（5201404f..88c10770），T34 行内容属 T34 自述口径，本任务登记遗留不改行（避免越权改写他任务实录）。

## 6. 风险与依赖

- **check-tasks 三件套 existsSync 门槛**：commit message 代理机制（pre-commit 以 HEAD message 为代理，records/topics/ci-infra.md CI-10 已记）下，凡含 R3/R4 文件的 commit 且前一 commit 为 `task: T36` 时，T36 三件套必须已全部落盘。commit 排序据此设计：commit 1（docs 大扫除，代理=T35 通过）→ commit 2（代码+zones.json，非大改动仅 zones 报警）→ commit 3（check.ts 规则，非大改动）→ 自检+核验 → commit 4（三件套+收口行翻）。
- **oxfmt 格式**：zones.json / vue / ts 改动后跑 `bunx oxfmt --write` 再 format:check（SOP-4 实证教训）。
- **T35 还原的两 i18n 文件不动**（D-拍板③ 取舍），保住字节一致 = 下轮合并零冲突。

## 7. 关联文档

- self-check：[T36-self-check.md](T36-self-check.md)
- verify：[T36-verify.md](T36-verify.md)
- 索引：[tasks/_index.md §2](../tasks/_index.md)
- 纪律：[05-process.md §3.2 / §4](../05-process.md)、[04-porting-discipline.md §5](../04-porting-discipline.md)
- 追认落点：[records/topics/upstream-merge.md](../records/topics/upstream-merge.md)、[records/topics/ci-infra.md](../records/topics/ci-infra.md)
