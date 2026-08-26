<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T32 独立核验 · zones 边界纠正（ownedFile→tarball 模式）+ check.ts 机制改造

> **状态**：✅ 已核验 | **时间**：2026-08-26 | **核验人**：subagent 独立核验
> **锚点**：HEAD=73b82c55（rebuild/pi-zone-cleanup）| 基线=38029fc5（T31 收口）| 上游=88c1077071328b8df68f282543f16e20e97930b4
> **核验方式**：先跑命令取实测（git diff / python json 解析 / grep 行号 / 门禁命令 exit code / gh api），再据实填写；全部结论均有当日可复现命令支撑。

## V1 · 字节一致性核验（对应 plan C1）——判定：✅

实测命令：对下列 8 个文件逐一执行 `git diff 88c10770..HEAD -- <path>`，统计输出行数：

| 文件 | diff 行数 |
| --- | --- |
| src/app/editor/vector/create.ts | 0 |
| src/app/editor/vector/handles.ts | 0 |
| packages/core/src/vector/handle-selection.ts | 0 |
| packages/vue/src/canvas/vector-input/bend.ts | 0 |
| packages/vue/src/shared/input/vector/hit-test.ts | 0 |
| packages/core/src/canvas/overlays/index.ts | 0 |
| src/app/editor/session/modules.ts | 0 |
| src/components/recovery/RecoveryDialog.vue | 0 |

结果：8/8 全部空 diff（5 个 vector 文件 + 3 个 tarball 抽样复核文件与上游 88c10770 字节一致）。判定 ✅。

## V2 · zones.json schema + 实体核验（对应 plan C2/C3/C4）——判定：✅

实测命令：`python` json 加载 `tools/zone-registry/zones.json`（2026-08-26）：

- **ownedFiles**：共 6 条（ChatModeSelect / ChatStyleProfileSelect / PiModelsPanel / stock-photo-keys.ts / media-credentials.ts / AppTextButton.vue）；含 `src/components/ui/AppTextButton.vue`；按 'vector' 过滤零命中（不含任何 vector 路径）。
- **patches**：id 列表含 P98, P99, P100, P101, P102, P60, P61, P74；P62–P73 及 P75–P82 共 20 枚缺号 id 全部零命中。
- **upstreamMergeTarball**：恰 1 条记录——`base=88c1077071328b8df68f282543f16e20e97930b4`（task=T31 retro-T32），`paths` 长度 **44**，条目内 `deletedPaths` 长度 **3**（vector-edit / canvas/node-edit / shared/input/node-edit 三处目录）。
- **顶层 deletedPaths**：长度 114，其中 `tests/e2e/**.spec.ts-snapshots/*.png` snapshot png 共 **11** 条；不含 AppTextButton.vue（它已转 ownedFiles）。

判定 ✅。

## V3 · check.ts 改造核验（对应 plan C5）——判定：✅

实测（grep 行号 + 运行，2026-08-26）：

- 五个函数定义齐备：`collectRenames`(L131)、`checkUpstreamMergeTarball`(L146)、`checkRenames`(L168)、`checkGhostDeleted`(L202)、`checkDriftTarball`(L254)。
- F1 升红收口：`main()` 中 violations 数组装配（L388-L397）含 `...checkDriftTarball(zones)`（L395），且 L385 注释明示「T32：rename 交叉一致性 + tarball drift（F1 收口评审：drift 判红，不 warn）」——drift 违规并入 violations 走判红退出路径。
- 实跑 `bun tools/zone-registry/src/check.ts`：**exit 0**，末行 clean 摘要：`[zones] clean: 76 modified (all registered), 302 added (owned), 1039 deleted (all registered), 13 renamed (cross-checked), base 5201404f`——含 renamed 计数 **13**。

判定 ✅。

## V4 · 文档纪律核验（对应 plan C8/C9/C10）——判定：✅

实测（grep/awk 定位行号，2026-08-26）：

- [04-porting-discipline.md](../04-porting-discipline.md)：L54 存在标题「## 5. owned/follow/tarball 三态边界判定（T32，2026-08-26 owner 拍板）」；§5.2 明确 `checkDriftTarball` 在 byte 不一致时**判红**（violation `TARBALL_DRIFT: <path>`），并附 F1 说明「初版 warn 不阻断……实测升红时零 drift，无副作用」——写的是判红非 warn。
- [02-phase-0.md](../02-phase-0.md)：§3.3 末尾存在补充句「**§3.x 补充（T32，2026-08-26）**：tarball/tarball 替换式合并的 path 登记走 zones.json 新增 `upstreamMergeTarball` 顶层字段……详见 [04-porting-discipline.md §5]」，指向 04 §5。
- [records/topics/upstream-merge.md](../records/topics/upstream-merge.md)：旧叙事「T10 tarball 法把上游 rename 落成」grep 零命中（exit 1）；L79 含 `checkGhostDeleted` 根治说明（T10 留死目录根因 = 当时无 ghost-deleted 兜底，T32 新增该函数根治，同步清掉 12 个 ghost）；L86 存在「## T32 追写（2026-08-26） · zones 边界纠正 + check.ts 机制改造」追写段（含验收/self-check/独立核验链接）。

判定 ✅。

## V5 · check 全套 + 三件套收口核验（对应 plan C6/C7/C11/C12）——判定：✅

门禁实跑 exit code（2026-08-26，HEAD=73b82c55）：

| 命令 | exit | 关键输出 |
| --- | --- | --- |
| `bun run check:zones` | 0 | clean 摘要：76 modified / 302 added / 1039 deleted / **13 renamed** |
| `bun run check:docs` | 0 | 40/40 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式） |
| `bun run check:bindings` | 0 | 无变更，跳过 |
| `bun run check:tasks --base 38029fc5` | 0 | 大改动判定成立（R1 文件数 25≥10 / R2 行数 1123≥200）；新增 P98-P102、移除 P62-P82 缺号段；T32 三件套齐全 |
| `bun run format:check` | 0 | 2030 文件格式正确 |
| `bun run lint` | 0 | **恰好 3 warnings / 0 errors**，均为存量 max-lines（617/704/608，上限 600），1342 文件 × 348 规则 |
| `bun run smoke:pi` | 0 | 5 脚本全过：t22 target **6** + t22 history **12** + t23 sessions **14** + t24 prompt-assembly **29** + t28 session-gc **19** = **80 passed, 0 failed** |

物证核验：

- `git log --oneline -4`：`73b82c55` → `414d37d8` → `0fbfd65e` → `38029fc5`，与预期链一致（73b82c55 未推送属预期）。
- `gh api repos/another-momo/open-pencil/actions/runs?per_page=6`：head_sha=`414d37d8` 的 CI run 在 **rebuild/pi 与 rebuild/pi-staging 双双 conclusion=success**（completed）；另观察：0fbfd65e 在 staging 为 failure（中间提交，已被 414d37d8 修复）、38029fc5 两分支 success。
- [tracker.md](../tracker.md) L43 有 T32 行（状态 🔄）、[tasks/_index.md](_index.md) L66 有 T32 永久行（🔄 进行中）——行翻 ✅ 由主 agent 收口时执行，当前态属预期。

判定 ✅。

---

## 收口判定

V1–V5 全部 ✅，无 ❌ 项：**可以收口**。（后续动作归主 agent：S11 推 staging + T32 行翻 ✅。）

## 关联文档

- plan：[T32-plan.md](T32-plan.md)
- self-check：[T32-self-check.md](T32-self-check.md)
- 三态边界判定新规：[04-porting-discipline.md §5](../04-porting-discipline.md)
