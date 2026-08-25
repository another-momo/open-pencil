<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T26-verify.md · T26 独立核验记录

> **T 编号**：T26（Phase 1 收口后整改 · 文档叙事面）
> **状态**：✅ 已核验（2026-08-25 独立 subagent 执行；核验员非实施者）

## 核验项（预审自 [T26-plan.md §2](T26-plan.md) 验收清单 C1-C8 派生）

| #   | 核验项                                                                                                       | 结果   | 证据节 |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ------ |
| V1  | T22 假绿更正真实完整：4 处可改面已改实录 + CI-12 条目存在且含两 run id + commit message 不可改声明             | ✅     | §V1    |
| V2  | 05 附录 B.3 新规则存在且语义为「verify 必含 gh run view 远端 CI 复验，缺失即打回」                             | ✅     | §V2    |
| V3  | 阶段门表与任务表一致（Phase 1/2 行 vs T11-T25 ✅）；T11 行翻 ✅ 有据                                          | ✅     | §V3    |
| V4  | 决策表同步抽查：01 §6 指针/D2/D7/D3/D5 标注、03 §0/§5/§6 回血、topics 三档案 append 条目                      | ✅     | §V4    |
| V5  | 证伪项复核：抽查「00 303 行」反证命令（git show 两测量点）与 minimax T25 错位时效性结论                        | ✅     | §V5    |
| V6  | records append-only 零违反：git diff 复核 records/ 下改动无删除既有内容（活索引表除外）                        | ✅     | §V6    |
| V7  | 门禁复跑：check:docs / check:bindings 绿                                                                      | ✅     | §V7    |
| V8  | 远端 CI 复验（05 附录 B.3 口径）：`gh run view` 本任务收口 commit 的 rebuild/pi run 结论全绿                   | ✅     | §V8    |

## 证据

### §V1 T22 假绿更正完整性（全要素在案）

- 四处可改面均含两 run id 实录：`grep -n "32687026233\|32687981729"` 命中 tracker.md:58（T22 行实录「均 failure，红于 format:check」）、tasks/_index.md:54（T22 行更正说明）、T22-self-check.md:12（头部更正记录行，保留原始错误说明）、records/narrative/tracker.md:459-465（末尾勘误段，旧条目 :387 原文未动）
- ci-infra.md CI-12（:185-206）完整实录：含两 run id + headSha 对照 + T23 吸收反证 +「无法改正处：commit a52add36 message 内…入 git 历史不可改，以 docs 更正为准」声明 + 根因（verify 缺远端 CI 复验项）+ 教训补救三条；T22-verify.md:87 有「更正补记」节
- 独立复验（2026-08-25 本核验员实跑）：`gh run view 32687026233 --json conclusion` → **failure**；`gh run view 32687981729 --json conclusion` → **failure**——更正内容与远端事实一致

### §V2 05 附录 B.3 规则

- 05-process.md:241 起 `### B.3 自检后：subagent 核验` 存在；:248 实载「**verify 必须含远端 CI 复验项**（2026-08-25 新增，T22 假绿事件触发……凡 self-check / tracker 登记了远端 CI run 结论的，verify 必须用 `gh run view <id> --json conclusion`……独立复验该结论为真；**核验范围缺此项即打回**」——语义与验收口径精确吻合

### §V3 阶段门与任务表一致

- tracker.md:18 重排注在案；:24 Phase 1 行 = ✅（据：D24 拍板 2026-08-23 + T11-T13 spike 实录 + 「能力契约测试绿」无定义判据废止标注）；:25 Phase 2 行 = 🔄「仅剩 F0.3② 生图独立凭证待建」——与 01-target-state.md:30 F0.3 处置列「①已建成（T21）②待建」一致；F0.1/F0.2/F0.4/F0.5/F0.6 处置列（01:28/29/31/32/33）亦与 tracker 行逐条对应
- tracker.md:47 T11 行 = ✅ 已完成，注「活模型面由 T18 补跑完成——S-pi-1 活模型 8/8……2026-08-25 翻 ✅」有据（T18 行:54 互证）

### §V4 决策表同步抽查（全过）

- 01 §6（:78-93）：表头注明示原「集中登记于 tracker.md §1」系错误指针、D 决策登记在 records/topics/；表增「状态/登记档案」两列；D2=**已拍板**（2026-08-20 owner）、D7=**已拍板 = D24**、D3=**已事实落地**（T22/T23）待补签、D5=**已事实落地**（T24）待补签；D1/D4/D6/D8 保持 open
- 03 回血实证：§0（:21）「终局已定（D24，2026-08-23 owner 拍板）」；§5 标题（:159）已去「待 owner 拍板」改「已拍板：D24」+ §5.1 拍板结论行（:168）；§6 索引（:229）指针 = records/topics/agent-runtime.md D9/D22/D24（不再指错误目标）
- topics 三档案 append 条目在案：agent-runtime.md:238（D9/D7 闭环 + 全局 D 注册表 D24 后停更记录）、chat-ui.md:45（D5 事实落地待补签）、docs-governance.md:437-447（D11 补登记消解悬空指针 + D16 前提过期 + 冻结期提案状态）

### §V5 证伪复核（两条均成立）

- 00「303 行」：00-why-rebuild.md:38 引证 `public/default-brand/config.yaml`（恰 303 行）；实测 `git show a1c33881:public/default-brand/config.yaml | wc -l` = **303**，`git show 5d38aa4e:public/default-brand/config.yaml | wc -l` = **303**——00 原文成立、review 的 243 不成立；证伪注记已追加 records/narrative/00-why-rebuild.md:52
- minimax T25 错位：T25-verify.md 头部状态行实测 =「✅ 已核验（2026-08-24 独立 subagent 执行；核验员非实施者）」——磁盘态早已 ✅，时效性误报结论成立

### §V6 records append-only 复核

- `git diff 48a46385 ebaa0e1c --stat -- docs/rebuild/records/` → 13 文件 +156/-8
- 逐 hunk 复核（diff hunk 头 + 删除行内容）：11 个 narrative/topics 档案全部为尾部纯追加 hunk（@@ -N,3 +N,M @@ 形态）；_index.md 7 行删除全部落在头部时间行与 §3 活索引表行（纪律豁免项，修正内容 = D5 档案归属/CI-13 计数等，与 self-check §1.4 自述一致）
- 唯一疑义行已消解：chat-ui.md 的 1 行「删除」是文件末行补尾随换行的 diff 表象——删除行与新增行文本逐字节相同（原「\ No newline at end of file」），既有档案内容零删改
- 结论：append-only 零违反

### §V7 门禁复跑（2026-08-25 本机实跑）

- `bun run check:docs` → `39/39 通过（R1-R5）` exit 0
- `bun run check:bindings` → 净树默认跳过；以 `--base 48a46385` 覆盖 T26+T27 全变更集实跑 → `66 文件变更，binding 全绿` exit 0

### §V8 远端 CI 复验（05 附录 B.3 口径）

- `gh run view 32809703730 -R another-momo/open-pencil --json conclusion,status,headSha,headBranch` → `conclusion=success, status=completed, headBranch=rebuild/pi, headSha=ebaa0e1c`（2026-08-25 独立 subagent 实跑）
- headSha ebaa0e1c 即本任务（T26）收口 commit——文档面更正的 CI 结论为真

## 总结论

**可以收口。** V1-V8 全过：T22 假绿更正在四处可改面 + CI-12 + T22-verify 补记全部实录，且本核验员对两 run 独立 `gh run view` 复验均 failure（更正与远端事实一致）；05 附录 B.3 强制规则语义精确；阶段门表与 01 §2 F0 处置列逐条互洽；01 §6/03/topics 三档案决策表同步抽查全中；两条证伪（00 303 行、T25 错位）经独立命令复核成立；records/ 13 文件改动经逐 hunk 复核为 append-only（_index 活索引表修正属纪律豁免，chat-ui.md 伪删除行为换行符表象）；check:docs 39/39 与 check:bindings（--base 全变更集）双绿；远端 CI run 32809703730 独立复验 success。
