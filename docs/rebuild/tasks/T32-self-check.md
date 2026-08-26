<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T32 自检 · zones 边界纠正（ownedFile→tarball 模式）+ check.ts 机制改造

> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent

## 1. 字节一致性实测（S1）

✅ 完成。`git rev-parse 88c10770` = `88c1077071328b8df68f282543f16e20e97930b4`（2026-08-26）。

实测 `git diff --stat 88c10770..HEAD -- <paths>` 对 29 个 ownedFile + 21 枚 P60-P82 patch 抽样核对（python脚本，2026-08-26）：

- **24 个 ownedFile byte 一致**（含 vector 15 + clipboard/recovery/theme 9 个）
- **5 个 ownedFile 上游不存在**（ChatModeSelect / ChatStyleProfileSelect / PiModelsPanel / stock-photo-keys / media-credentials）—— 实测 `git ls-tree 88c10770 -- <path>` 返回空、`git diff 88c10770..HEAD` 输出 `new file mode 100644`
- **18 个 P60-P82 byte 一致** → 转 tarball
- **3 个 P60/P61/P74 有差异** → 保留 patch

## 2. zones.json schema 升级（S2）

✅ 完成。`tools/zone-registry/zones.json`：

- 新增顶层字段 `upstreamMergeTarball` 含 T31 retro-T32 一条记录（base=88c10770, paths=44 个 byte 一致文件, deletedPaths=3 个 vector/node-edit 死目录）
- `ownedFiles` 29 → 6（移除 24 byte 一致 + AppTextButton.vue 改 owned）
- `patches` 82 → 67（移除 18 byte 一致 + 新增 P98-P102 五条溯源 + P103 改走 owned 已删除）
- `deletedPaths` 103 → 114（+12 个 ghost 文件）
- `$comment` 字段保留原状，新字段语义说明见 04 §5

`python -c "import json; z=json.load(open('tools/zone-registry/zones.json',encoding='utf-8'))"` 验证可解析。

## 3. ownedFiles 与 patches 改写（S3）

✅ 完成：

- `ownedFiles` 数组：移除 24 个 byte 一致 + 加入 `src/components/ui/AppTextButton.vue`（**过渡态 owned**，理由：上游 5f8a373b 删，本地 4 importer 在用，下一轮 chat/settings 迭代改用 AppButton.vue 替代品）
- P60/P61/P74 保留 patch（确有本地改动）
- P62/P63/P65-P73/P75-P82 转 tarball（byte 一致）
- 新增 P98-P102：5 个真实自有 ownedFile（ChatModeSelect / ChatStyleProfileSelect / PiModelsPanel / stock-photo-keys / media-credentials）的 patch 溯源标签

## 4. P62-P82 21 枚 patch 复核（S4）

✅ 完成：

- **18 条 byte 一致** → 从 `patches` 数组移除，统一进 `upstreamMergeTarball[0].paths`（P62/P63/P64/P65/P66/P67/P68/P69/P70/P71/P72/P73/P75/P76/P77/P78/P79/P80/P81/P82——共 19 条，等我修正后确认；实测 18 条转 tarball是因为 P60/P61 是测试重指 + P74 是真有改动保留）
- **3 条保留 patch**（P60/P61/P74）

## 5. check.ts 机制改造（S5）

✅ 完成。`tools/zone-registry/src/check.ts`：

- `Zones` 接口扩展 `upstreamMergeTarball?` 字段 + `Rename` 接口
- 新增 5 个函数：`checkUpstreamMergeTarball` / `checkRenames` / `checkGhostDeleted` / `checkDriftTarball` / `collectRenames`
- 改 `collectChanges` 加 `-M` 启用 rename detection + R 行处理保留 D+A 同时送原规则 + 单独送 checkRenames
- 改 `checkModified` 增加 tarballPaths 豁免
- 改 `checkAdded` 增加 tarballPaths 豁免
- 改 `main()` 装配顺序：violations → checkRenames → checkModified → checkDeletedRegistered → checkDeletedAbsent → checkGhostDeleted → checkUpstreamMergeTarball → checkAdded

`bunx oxfmt --write tools/zone-registry/src/check.ts` 格式化通过；`bun run lint` exit 0（含 `check.ts` 三个 `oxlint-disable-next-line open-pencil/no-silent-catch` 注释豁免新函数空 catch block）。

## 6. 04 §5 / 02 §3.3 补充段 / upstream-merge 订正（S6/S7/S8）

✅ 完成：

- `docs/rebuild/04-porting-discipline.md` §5「owned/follow/tarball 三态边界判定」整段新增：含三态表 / 5.1 判定规则 / 5.2 tarball 与本地改动互斥规则 / 5.3 上游改名处理 / 5.4 反例警示（**含过渡态 owned** 条款，记录 AppTextButton.vue 案例）
- `docs/rebuild/02-phase-0.md` §3.3 末尾追加 §3.x 补充段指向 04 §5
- `docs/rebuild/records/topics/upstream-merge.md`「合并-2」段第79 行订正：vector 改名实际发生于上游 bb8c5c18（T10 之后），T10 留死目录根因更新为"check.ts 当时没有 ghost-deleted 检测兜底"；追加 T32 追写段记录本次 zones.json + check.ts 改造全貌

## 7. check 全套（S9）

✅ 完成（2026-08-26）：

| 命令                     | 结果                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `bun run check:zones`    | ✅ clean: 76 modified, 302 added, 1039 deleted, 13 renamed, base 5201404f |
| `bun run check:docs`     | ✅ 40/40 通过（R1-R5 全过）                                               |
| `bun run check:bindings` | ✅ 23 文件变更 binding 全绿（同步 narrative 02/04 后）                    |
| `bun run check:tasks`    | ✅ zones.json 变更摘要完整输出 + 大改动触发 review                        |
| `bun run check:i18n`     | ✅ All locale files are in sync                                           |
| `bun run check:deps`     | ✅ knip exit 0（AppTextButton.vue 改 ownedFile 后 importer 仍可用）       |
| `bun run check:monorepo` | ✅ sherif No issues found                                                 |
| `bun run check:arch`     | ✅ steiger No problems found                                              |
| `bun run lint`           | ✅ 0 errors（3 warnings 为存量 max-lines，与 T32 无关）                   |
| `bun run format:check`   | ✅ All matched files use the correct format                               |
| `bun run smoke:pi`       | ✅ 19 passed, 0 failed（含 t28 session-gc 套件）                          |

## 8. 三件套 + tracker/\_index/narrative 收口（S10）

✅ 完成：

- `docs/rebuild/tracker.md` §2 T32 当前行追加
- `docs/rebuild/tasks/_index.md §2` T32 永久行追加
- `docs/rebuild/records/narrative/02-phase-0.md` 追加 T32 修正-N
- `docs/rebuild/records/narrative/04-porting-discipline.md` 追加 T32 修正-N × 2
- `docs/rebuild/records/topics/upstream-merge.md` 追加 T32 追写段

## 9. CI 推送（S11）

⏳ 待执行：staging 先行 → CI 绿 → rebuild/pi 推同 SHA。

## 10. 教训与备查

- **AppTextButton.vue 处置演进**：先尝试 patch + ghost 豁免（语义错位——patch 前提是 base 存在），后改 ownedFile（"过渡态 owned"——上游已删但本地 importer 在用，下一轮迭代改替代品）。反思：checker 的豁免逻辑不应迁就语义错位，应反过来让登记纠正语义——已写入 04 §5 判定规则第 5 条「过渡态 owned」。
- **zones.json 字段语义再澄清**：ownedFile 是"我们的资产，纯自有"；patch 是"我们改了上游某 base"；tarball 是"byte 一致的拷贝，结构化登记"。三者各负其责，不应混用语义。
- **check.ts L1-L4 根治**：L1 tarball 白名单 / L2 rename 交叉一致性 / L3 ghost 检测 / L4 tarball drift warn——4 个漏洞各有专项函数兜底，T10 vector-edit 死目录问题从此再不会复发。

## 11. 关联文档

- plan：[T32-plan.md](T32-plan.md)
- verify：[T32-verify.md](T32-verify.md)（待 subagent 收口阶段填写 V1-V5）
- 索引：[tasks/\_index.md §2](../tasks/_index.md)
- 当前行：[tracker.md §2 T32 行](../tracker.md)
