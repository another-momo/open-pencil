<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/ci-infra.md · CI / zone registry / autocrlf

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：CI 跑批历史、zone check 漏洞修复、autocrlf 治理、远端同步记录。

---

## CI 跑批历史

## CI-1 · run 32243617082

- **类型**：核验
- **时间**：2026-08-19 14:00
- **方法**：gh run watch + --log-failed
- **结论**：3 job 红：Repository hygiene（doc 链接校验，docs site 已删）、Component workshop（storybook build 挂：public/ 图标是指向已删 desktop/ 的悬空 symlink）、Code quality（format:check）
- **修法**：P26 移除 check:docs 步骤、P27-P30 symlink 换真实 PNG

## CI-2 · run 32244794271

- **类型**：核验
- **时间**：2026-08-19 15:00
- **方法**：同上
- **结论**：3 job 红：Repository hygiene（test:tools）、Component workshop（storybook 仍挂）、Code quality lint 10 错（#core/* alias、!==-1、complexity 25、空函数、promise executor return 等）
- **修法**：bdb3a042 逐项清理

## CI-3 · run 32246179576

- **类型**：核验
- **时间**：2026-08-19 15:30
- **方法**：同上
- **结论**：Code quality lint 余 1 错：i18n 缝测试 `no-promise-executor-return`
- **修法**：7b8ecab1

## CI-4 · run 32247060166

- **类型**：核验
- **时间**：2026-08-19 16:00
- **方法**：同上
- **结论**：Code quality `check:arch`：steiger strict-tools-layout 拒 tools/zone-registry/check.ts（须落 tools/<domain>/src/**）
- **修法**：3dcc4f2c 挪至 src/check.ts + 仓根解析改 ../../.. + 同步 package.json check:zones / zones.json $comment / 02 与 tracker 引用。无新补丁：挪动全程在 owned root 内，package.json 变更由既有 P17（scripts）覆盖

## CI-5 · run 32248474442

- **类型**：核验
- **时间**：2026-08-19 16:30
- **方法**：gh run view --json jobs
- **结论**：**全绿**：11/11 job success（Repository hygiene / Code quality / Package integrity / Component workshop / Engine tests ×7）

## P0-9 · autocrlf 治理

- **类型**：核验
- **时间**：2026-08-19 14:00
- **结论**：`core.autocrlf=false`（仓库级）+ 双 worktree LF 归一化。autocrlf 类幻影 M 根除；LFS 类幻影保留（纪律约束）
- **配置位置**：`.git/config`（不入库）。新 clone/新 worktree 继承仓库级配置，但其他机器/其他仓库需各自设置

## P0-10 · 远端同步

- **类型**：核验
- **时间**：2026-08-19 16:30
- **方法**：`git ls-remote origin rebuild/v2`
- **结论**：远端 = 4a17fc77 = 本地 HEAD；tracking 已指向 origin

---

## zone check 漏洞修复（subagent A 轮机械审计）

- **时间**：2026-08-19 16:00
- **类型**：核验
- **核验人**：subagent A
- **范围**：check.ts 四处漏洞
- **修复**：
  1. 删除侧零校验（曾漏检 7 个 notifications locale json 的删除——已补登）→ D 状态必须登记 deletedPaths
  2. R/C/T/U 状态逃逸 → 重命名拆解为删+增，其他状态显式报错
  3. revoked 补丁仍白名单 → 过滤
  4. 头注释死规则（pendingReclass 字节一致）删除，与 zones.json 口径对齐
- **探针测试验证**：未登记删除被抓（exit 1）