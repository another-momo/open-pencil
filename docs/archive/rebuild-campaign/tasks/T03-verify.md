<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T03-verify.md · T03 subagent 核验报告

> **T 编号**：T03（文档治理）
> **核验时间**：2026-08-21（commit `b58e593c` 落地后，owner 二次提示后立即派单）

## 1. 核验背景

owner 二次提示「T03 文档显示完成度才 70%，怎么就结束了 + 也没有排出 subagent 核验」——主 agent 不应等 owner 触发，直接派单核查。本核验由 general-purpose subagent A 独立执行（只读，不修改任何文件）。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T03 全部交付物
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T03-plan.md §3 验收标准](T03-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | 05 §3.2 含「一一对应」 | ✅ | `grep -n "一一对应" docs/rebuild/05-process.md` | 2 处（行 6 头部引用、行 84 §3.2 文件维度段含「与物理文件一一对应」） |
| 2 | 05 §3.2 含「错误示范 2」 | ✅ | `grep -n "错误示范 2" docs/rebuild/05-process.md` | 1 处（行 87） |
| 3 | 05 §4 含 §4.10 章节 | ✅ | `grep -nE "^10\.\|§4\.10" docs/rebuild/05-process.md` | 3 处命中：行 6 引用、行 87 引用、行 134 §4.10 标题 |
| 4 | 05 §4.10 含五条核心约束 | ✅ | `grep -n "核心约束\|两层关系\|修改触发\|新增删除触发\|CI 拦截" docs/rebuild/05-process.md` | 五条全中（行 135-139，均在 §4.10 内） |
| 5 | 05 §3.1 gate review 列表含 5 项 | ✅ | `awk '/^### 3\.1/,/^### 3\.2/' docs/rebuild/05-process.md \| grep -E "^[0-9]+\. "` | 5 项（CI 全绿 / zone check / 文档格式校验 / 文件↔record 一一对应核验 / subagent 文档核验） |
| 6 | 05 头部状态字段「草稿」+ 2026-08-21 | ✅ | `head -15 docs/rebuild/05-process.md` | 行 11 含「**状态**：草稿」和「2026-08-21」 |
| 7 | docs-governance.md 含 D14 条目 | ✅ | `grep -n "^## D14" docs/rebuild/records/topics/docs-governance.md` | 1 处（行 287） |
| 8 | D14 条目含关键字段（类型/时间/拍板/依据） | ✅ | `awk '/^## D14/,/EOF' docs/rebuild/records/topics/docs-governance.md \| grep -E "类型\|拍板\|时间\|依据"` | 四项全中 |
| 9 | records/narrative/05-process.md 追加 v4 修正条目 | ✅ | `grep -n "修正-N · 05-process.md v4" docs/rebuild/records/narrative/05-process.md` | 1 处（行 67） |
| 10 | records/narrative/tracker.md 追加 T02+T03 修正条目 | ✅ | `grep -n "修正-N · tracker.md T02 状态更新" docs/rebuild/records/narrative/tracker.md` | 1 处（行 53） |
| 11 | T03 三件套存在 | ✅ | `ls docs/rebuild/tasks/T03-{plan,self-check,verify}.md` | 3 文件齐全 |
| 12 | T03 自检完成度数字与状态字段一致 | ✅ | `grep -n "100%\|70%" docs/rebuild/tasks/T03-self-check.md` | 自检「完成度自评」含「100%」 |
| 13 | tracker.md §2 含 T03 行 | ✅ | `grep -n "T03" docs/rebuild/tracker.md` | 1 处（行 35，任务表内） |
| 14 | tasks/_index.md 含 T03 行 | ✅ | `grep -n "T03" docs/rebuild/tasks/_index.md` | 1 处（行 31） |
| 15 | commit b58e593c 存在且含 T03 task 文档 | ✅ | `git show --stat b58e593c \| grep -E "T03-process-binding-clause"` | 1 处命中 |
| 16 | CI run 32434330293 通过 | ✅ | `gh run view 32434330293 --repo=another-momo/open-pencil --json conclusion` | `{"conclusion":"success"}` |
| 17 | 05 §4.10 引用格式正确 | ✅ | `grep -n "05-process.md §4.10" docs/rebuild/05-process.md` | 2 处：行 6 头部纪律提示块、行 87 §3.2 错误示范 2 引用 |
| 18 | §4.9 在 §4.10 之前 | ✅ | `grep -nE "^9\.\s\|^10\.\s" docs/rebuild/05-process.md` | 行 133 §4.9 交叉引用格式、行 134 §4.10 文件↔record 一一对应纪律（顺序正确） |

## 3. 总评

- 通过：18 条
- 失败：0 条
- 无法验证：0 条

## 4. 综合判定

- ✅ **T03 全部交付物通过核验**——三件套（plan + 自检 + 核验）已闭环
- ✅ commit `b58e593c` 落地 + CI `32434330293` 11/11 全绿 + subagent A 独立核验 18/18 通过
- ✅ 100% 完成度与实际进度同步（owner 二次提示后立即修正）

## 5. 补充（2026-08-21 · owner 二次提示后三件套物理拆分）

owner 在 2026-08-21 进一步提议「三件套物理拆分 + 任务表填三列路径」后，原 T03 单文档 `[T03-process-binding-clause-2026-08-21.md](T03-process-binding-clause-2026-08-21.md)` 已拆为 [T03-plan.md](T03-plan.md) / [T03-self-check.md](T03-self-check.md) / [T03-verify.md](T03-verify.md) 三件套。本核验报告（verify.md）就是拆分后的承载文档。
