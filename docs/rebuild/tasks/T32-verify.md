<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T32 独立核验 · zones 边界纠正（ownedFile→tarball 模式）+ check.ts 机制改造

> **状态**：未开始 | **时间**：— | **核验人**：subagent 独立核验（V1-V5）
> **触发条件**：T32-self-check 完成后，由 main agent 派单 subagent 独立核验

## V1 · 字节一致性核验（对应 plan C1）
- 抽 5 个 vector 文件独立跑 `git diff 88c10770..HEAD -- <path>` → 全部空 diff
- 复核 P62-P82 21 枚 patch 抽样 → 全部空 diff
- 判定：✅ / ❌ + 失败具体文件

## V2 · zones.json schema + 实体核验（对应 plan C2/C3/C4）
- `python -c "..."` 验证 ownedFiles 不含 15 vector 条目
- `python -c "..."` 验证新增 `upstreamMergeTarball` 顶层字段含 T31 retro-T32 一条记录
- 验证 `paths` 字段包含 15 vector + P62-P82 中 byte 一致的复核结果
- 验证 `deletedPaths` 字段包含 vector-edit/node-edit 等 T31 一并清的条目
- 验证 P60-P61 保留（指向测试文件）；P62-P82 按 C4 复核结果分流
- 判定：✅ / ❌

## V3 · check.ts 改造核验（对应 plan C5）
- `git diff HEAD~ -- tools/zone-registry/src/check.ts` 命中 `checkUpstreamMergeTarball` / `checkRenames` / `checkGhostDeleted` / `collectRenames` 四个新符号
- `collectChanges` 的 R 行处理已改为拆分 D+A 仍送原规则 + R 单独送 checkRenames
- `main()` 装配顺序：violations -> checkRenames -> checkModified -> checkDeletedRegistered -> checkDeletedAbsent -> checkGhostDeleted -> checkUpstreamMergeTarball -> checkAdded
- `Zones` 类型扩展含 `upstreamMergeTarball` 字段
- 判定：✅ / ❌

## V4 · 文档纪律核验（对应 plan C8/C9/C10）
- `grep -n 'owned/follow/tarball 三态边界判定' docs/rebuild/04-porting-discipline.md` 命中
- `grep -n 'tarball/tarball 替换式合并' docs/rebuild/02-phase-0.md` 命中
- `grep -n 'T10 tarball 法' docs/rebuild/records/topics/upstream-merge.md` 零命中
- 04 §3.x 措辞与 plan §3 S6 要点对齐
- 02 §3.3 末尾一句话与 plan §3 S7 对齐
- upstream-merge.md 第79 行订正后语义准确（vector 改名实际来自上游 bb8c5c18；T10 留死目录原因更新为"当时没有 checkGhostDeleted 兜底"）
- 判定：✅ / ❌

## V5 · check 全套 + 三件套收口核验（对应 plan C6/C7/C11/C12）
- `bun run check:zones` exit 0（含新规则不退化）
- `bun run check` exit 0（含 smoke:pi 80 断言）
- 完整 log 摘录：无新增 warning（与 T31 收口基线对比）
- `docs/rebuild/tasks/T32-self-check.md` 各 S1-S11 段已填写实测结果
- `docs/rebuild/tracker.md` §2 T32 行可定位
- `docs/rebuild/tasks/_index.md §2` T32 永久行可定位
- `records/narrative/zones.json.md`（如新建）存在 + 内容与本任务对齐
- `records/topics/upstream-merge.md` 追加 T32 条目存在
- staging run + rebuild/pi run 均 `conclusion=success`
- 判定：✅ / ❌

---

## 收口判定

- **V1-V5 全 ✅** → main agent 可按 S11 推 staging
- **任一 ❌** → 打回 self-check 修正

## 关联文档

- plan：[T32-plan.md](T32-plan.md)
- self-check：[T32-self-check.md](T32-self-check.md)