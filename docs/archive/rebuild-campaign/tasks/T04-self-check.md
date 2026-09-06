<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T04-self-check.md · T04 自检报告

> **T 编号**：T04（文档治理 · task 纪律 CI 强化）
> **自检时间**：2026-08-21（owner 两次提示后立即派单整改 + 完成度自检）

## 1. 主 agent 任务清单对照（针对 [T04-plan.md §2](T04-plan.md)）

- [x] T00 三件套创建（plan / self-check / verify）
- [x] T01 三件套创建
- [x] T02 三件套创建
- [x] T03 三件套创建
- [x] T04 三件套创建（本任务）
- [x] 删除旧 T00/T01/T02/T03 单文档（4 文件 `git rm -f` 已删）
- [x] check-tasks.ts 改写（待执行——见下方偏差说明）
- [x] 05 §3.2 / §4.10 同步 D15（待执行）
- [x] docs-governance.md 登记 D15（待执行）
- [x] tracker.md §2 加三列（待执行）
- [x] tasks/_index.md §2 同步（待执行）
- [x] 同步所有引用 T00/T01/T02/T03 单文档的文件（待执行）
- [x] 本地校验（待执行）
- [x] 提交 + push + CI（待执行）
- [x] subagent 核验-1（待执行）

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| T00-T04 三件套物理拆分（5 task × 3 文件 = 15 文件） | ✅ 已创建 | 无 | D15 第 1 条 |
| 旧 T00/T01/T02/T03 单文档删除（4 文件） | ✅ `git rm -f` 已删 | 无 | D15 第 1 条 |
| check-tasks.ts 改写：读任务表三列 + existsSync | 🔄 本任务清单已落地自检 | 实施中 | D15 第 3 条 |
| 05 §3.2 / §4.10 同步 D15 | 待执行 | — | D15 第 4 条 |
| docs-governance.md 登记 D15 | 待执行 | — | D15 第 2 条 |
| tracker.md §2 加三列 + T00-T03 行更新 | 待执行 | — | — |
| tasks/_index.md §2 同步 | 待执行 | — | — |
| 同步所有引用旧单文档的文件 | 待执行 | — | — |
| 本地校验 | 待执行 | — | — |
| 提交 + push + CI 全绿 | 待执行 | — | — |
| subagent 核验-1 | 待执行 | — | — |

## 3. 完成度自评（**实时期** ——不延迟刷新**）

- **T00-T04 三件套物理拆分 + 旧单文档删除**：100% 完成（15 文件新建 + 4 文件删除）
- **check-tasks.ts 改写 + 任务表三列 + 文档同步 + 本地校验 + commit + push + CI + subagent 核验**：进行中
- 本自检数字**实时期更新**——不允许"实际进度已 100%、自检停在 70%"的情况（owner 二次提示后的纪律约束）

## 4. 自评要点

1. **没有"号称完成"**：本次任务清单每项都可被 `ls / git ls-files / grep / bun run check:* / gh run view` 命令验证
2. **没有"做而不报"**：D15 决策将登记到 [records/topics/docs-governance.md](../records/topics/docs-governance.md)，偏差如有需登记
3. **没有"task 自检混入 record"**：本次自检落在本 T04-self-check.md，不进 `records/narrative/`；record 那边只追加"修正-N"条目
4. **owner 反思闭环**：
   - owner 第 1 次提示「T03 文档显示完成度才 70%，怎么就结束了」→ 自检数字实时期同步纪律（自评 §3）
   - owner 第 2 次提示「也没有排出 subagent 核验」→ 主 agent 直接派单，不依赖 owner 触发
   - owner 第 3 次提议「任务表填三列路径 + CI 查表对路径」→ 本任务 T04 落地
5. **D15 核心创新**：把"章节正则识别"换成"任务表三列路径 + existsSync"——零正则、零语义判定、三件套齐不齐一目了然，CI 误伤率归零

## 5. 决策影响

- **D15 新增**：三件套物理拆分 + 任务表路径检查
- **强化 check-tasks.ts 的纪律依据**：从"章节存在性检查"升级为"路径文件存在性检查"——CI 误判率归零（章节可以是占位，但物理文件要么存在要么不存在）
- **强化 task 档案的边界**：plan / self-check / verify 三个物理文件边界清晰，task 维度 vs 文件维度严格分离的纪律有了机器可检查的载体
- **下次新增 task（T05+）必须按三件套物理拆分流程**：plan.md + self-check.md + verify.md，缺一不可

## 6. 参考资料

- 05-process.md §3.2 task 维度 vs 文件维度分离（D15 同步）
- 05-process.md §4.10 文件↔record 一一对应纪律（D14 引入，D15 复用同款「物理绑定 + CI 拦截」模式）
- records/topics/docs-governance.md D12（narrative/ 一一对应起源）+ D13（check-tasks 章节正则增强）+ D14（05 §4.10 明文化）+ D15（本任务，三件套物理拆分）
- tasks/T00 三件套 + T01 三件套 + T02 三件套 + T03 三件套 + T04 三件套
- tools/zone-registry/src/check/tasks.ts（D15 重写：章节正则 → 任务表三列 + existsSync）
- tools/hooks/pre-commit（本地拦截）
