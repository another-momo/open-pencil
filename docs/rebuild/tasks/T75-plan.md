# T75 计划 · 整体 review 合并 + 选择性优化落地

> 日期：2026-09-02。来源：owner /goal「完成开发后请整体review……预研文档中
> 仍有一些内容可以选择性吸取，请对照检查分析和有选择性优化」——两份评审
> 报告已于 2026-09-02 产出（records/review-2026-09-01-code-review.md +
> records/review-2026-09-01-research-adjudication.md），本任务落地其
> 「必须吸收」档 + 两项低成本加固。

## 1. 范围（落地清单）

### A. 评审报告入档（仓内，docs/rebuild/records/）

- review-2026-09-01-code-review.md（代码面评审：T66-T72 七任务全绿，0 P0 /
  2 P1 / 3 P2 / 2 P3）
- review-2026-09-01-research-adjudication.md（预研对照：5 可吸收 / 7 冲突
  过期 / 3 潜在新增 / 1 失效引用）

### B. 预研裁决「必须吸收」档（父仓 doc/，纯文本修正，非 git 仓）

1. `doc/base-candidate-list.md` 条目 #1 状态回写——实际归宿 =
   longform.md 通用纪律第 2 则（T68），**非** base.md；三坑纪律未显式落地
   属真实增量（裁决 §2.1/§5.2）。
2. `doc/t67-marketing-prompt-mining.md` 头注——原出处已物理删除 + 迁移
   归宿指针（§2.2/§3.7）。
3. `doc/S2-asset-files-spec.md:58` 补注——system-prompt-marketing.md 已随
   T67 删除，句作历史批评留存（§5.3）。
4. `doc/S2-asset-files-spec.md:133` 段首改写——「随 W3 T-C1 执行」→ 按
   T67 完工事实写「分流定稿」（§3.3）。
5. `doc/S4-phase3-plan.md:122` 尾巴清理——T53 注入缝接线依赖已实质闭合
   （catalog 注入 + confirmedNewIntent 信封通道 T61 均已接线，本计划期
   grep 实证），行标 ✅ 闭合（§3.6/§5.3）。
6. `doc/T-C-survey-20260901.md` §3/§4 销账注记——触点清单已全部销账，
   保留仅为历史追溯（§3.4）。
7. `profile-as-skill-proposal.md` 任务链剔除——仓内仓外零引用（grep
   实证 2026-09-02），无需文件动作，以本计划登记为闭合（§5.1）。

### C. 仓内加固（代码评审报告）

- P2-03：`docs/rebuild/tasks/T66-verify.md` §10 措辞澄清——「零交叉」改写
  为「字面零交叉 + marketing 导入是 A 自身职责非 B 跨界」。
- P1-01：`tests/engine/rebuild/image-gen/internal-visibility.test.ts`
  新增反向钉扎——`packages/cli/src/**` 出现 ALL_TOOLS/FORK_TOOLS/
  toolsToAI 直接引用即 fail（防未来 CLI 消费面漏挂 internal 过滤）；
  目录消失时显式失败（防钉扎空转假绿）。
- 顺手修 `src/app/ai/pi-backend/setup-catalog.ts` 头注过期句——「落地前恒
  false」系 T53 契约期描述，T61 已落地（prepareTurn 信封置真），按现状
  改写（B-5 的仓内镜像，comment-only）。

## 2. 不做清单（评审报告其余条目及理由）

- P1-02 v3 profile derive_palette 4 处死链：处置方向（改写/下架/保留）需
  owner 裁决，本任务不动。
- P2-01 abort 不打断进行中长 HTTP：工具层 signal 透传属后续可选方向。
- P2-02 routes.ts 4xx 文案 i18n 化：错误码常量 + 前端转译，归下批。
- P3-01/P3-02：评审结论即「不动」。
- 裁决「可选吸收」8-12（brief 表单面板立项 / 中文字号底线 11px / 边注
  入档 / T70-verify 交叉引用）：立项级或 W4/W5 绑定项，留 owner 裁决；
  编号注意——裁决原文建议的「新立 T73/T74」已被实际 T73（stop 取消通道）
  /T74（桥启动 race）占用，未来立项须从 T76 起。
- 裁决「暂缓」13-17：阶段门后激活，不动。

## 3. 验收标准

1. 父仓 doc/ 6 处修正按 B-1..6 逐条落地（grep 可读回）。
2. T66-verify §10 措辞按 P2-03 建议改写。
3. internal-visibility.test.ts 新钉扎 5/5 绿；pi-backend 目录测试回归绿。
4. 门禁 unpiped 全绿：lint / tsgo / format:check / zones / i18n / docs。
5. 全量测试本机不跑（owner 2026-09-02 指示），以 CI 为准。

## 4. 边界

- 父仓 doc/ 非 git 仓（实证 `git status` fatal），修改为纯文件落地，无
  commit/push 面。
- 仓内改动全部位于 ownedRoots（records/ 与 tasks/ 属 docs 叙事面走
  check:tasks；测试文件在 tests/engine/rebuild/ ownedRoot；setup-catalog.ts
  在 src/app/ai/pi-backend/ ownedRoot）——零 zones 登记。
- 本任务无运行时行为变化（comment + docs + 新增测试三类）。
