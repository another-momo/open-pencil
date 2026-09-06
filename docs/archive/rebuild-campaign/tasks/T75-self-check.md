# T75 自检 · 整体 review 合并 + 选择性优化落地

> 日期：2026-09-02。实施 = 主 agent。对照 T75-plan §1/§3。

## 1. 交付清单

### A. 评审报告入档（仓内）

- `docs/rebuild/records/review-2026-09-01-code-review.md`（新，338 行）
- `docs/rebuild/records/review-2026-09-01-research-adjudication.md`（新，356 行）

### B. 父仓 doc/ 六处修正（非 git 仓，纯文件落地，均已 grep 读回）

1. `doc/base-candidate-list.md` 条目 #1 表后加「2026-09-02 状态回写」段——
   实际归宿 = longform.md 通用纪律第 2 则（T68）非 base.md；三坑未显式落地
   属真实增量；上收决策待 PD-20。
2. `doc/t67-marketing-prompt-mining.md` 头注补「2026-09-02 补注」——原出处
   已物理删除 + 迁移归宿指针（longform.md / base-candidate-list #1）。
3. `doc/S2-asset-files-spec.md:58` 补注——文件已随 T67 删除，句作历史
   批评留存。
4. `doc/S2-asset-files-spec.md:133` 段首改写——「退役分流（随 W3 T-C1
   执行）」→「分流定稿（2026-09-01 T67 完工……T75 按完工事实改写）」。
5. `doc/S4-phase3-plan.md:122` 尾巴行标 ✅ 闭合——T53 注入缝接线依赖实质
   闭合。实证（2026-09-02）：catalog 注入 `tools.ts:207` 外层挂
   `__confirmedNewIntent`；`active-design-host.ts:331/374/389` intentConfirmed
   信封置真链路在案（T61 UI 指令块 = 真源通道）。
6. `doc/T-C-survey-20260901.md` §3/§4 节首各加销账注记——触点已全部销账，
   保留仅为历史追溯。
7. profile-as-skill 任务链剔除：仓内 `grep -rn "profile-as-skill\|
   profile_skill" docs/ src/ tools/`（2026-09-02）——代码面与任务链零引用，
   现存命中均为本批评审报告与 T75 自述文档；无文件动作，以 T75-plan §1.B.7
   登记闭合。

### C. 仓内加固

- P2-03：`T66-verify.md` §10 措辞改写为「字面零交叉 + marketing 导入是 A
  自身职责非 B 跨界」。
- P1-01：`internal-visibility.test.ts` 新增第 5 例反向钉扎——CLI 包直接
  引用 ALL_TOOLS/FORK_TOOLS/toolsToAI 即 fail；`packages/cli/src` 目录消失
  时显式失败。现状实证：`grep -rln` 三符号零命中（2026-09-02）。
- `setup-catalog.ts:9-12` 头注过期句改写——「落地前恒 false」→ T61 已落地
  现状口径（comment-only，S4:122 尾巴闭合的仓内镜像）。

## 2. 门禁（unpiped，2026-09-02）

- `bun test tests/engine/rebuild/image-gen/ tests/engine/rebuild/pi-backend/`
  → **134 pass / 0 fail / 359 expects / 15 files**（internal-visibility 5/5
  含新钉扎；pi-backend 40/40 回归无损——setup-catalog 仅注释）。
- `bun run lint` → 0 errors（7 warnings 均既有）。
- `bun run tsgo` → exit 0；`bun run format:check` → all correct
  （oxfmt --write 仅施于本任务触及的两个 .ts 文件）。
- `bun run check:zones` → clean（改动全在 ownedRoots，零登记）。
- `bun run check:i18n` → in sync；`bun run check:docs` → 44/44。
- 全量 `bun test`：按 owner 2026-09-02 指示不在本机跑，以 CI 为准。

## 3. 偏差

1. 全量测试本机弃权（owner 指示）。
2. 评审报告编号碰撞登记：预研裁决建议的「新立 T73/T74」与已收口的实际
   T73/T74 撞号，未来立项从 T76 起（已写入 T75-plan §2）。
3. 父仓 doc/ 非 git 仓（`git status` → fatal 实证），B 组修正无版本控制面；
   仓内提交只含 A（报告入档）+ C（仓内加固）+ 三件套 + tracker。
4. 不做项按 T75-plan §2 逐条在案（P1-02 待 owner 裁决、P2-01/P2-02 归后续、
   可选吸收 8-12 立项级留 owner、暂缓 13-17 阶段门后激活）。
