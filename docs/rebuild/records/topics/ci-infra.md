<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/ci-infra.md · CI / zone registry / autocrlf

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
## D18 · LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner（基于"启用 LFS 缓存"决策，回应 owner 派 agent 排查 LFS 流量的反馈）
- **问题**：每次 push 触发 ~1 GB LFS 流量（7 个 engine test job × ~149 MB + heavy-tests 可选 +149 MB），全部打到上游 `https://lfs.openpencil.dev` 网关
- **流量实测（commit 落地前）**：
  - 单 job LFS pull：~149 MB（6 文件合计，nuxtui.fig 82M + material3.fig 55M + NotoSansSC 11M + gold-preview.fig 0.55M + NotoNaskhArabic 0.16M + circle-text.fig 0.15M）
  - 7 job × 149 MB = **~1.04 GB / push**
- **处置**：
  1. **cache 步骤**：`.github/actions/setup-bun/action.yml` 加 `actions/cache@v6`，path = `.git/lfs/objects`
  2. **cache key**：`lfs-${{ runner.os }}-${{ hashFiles('.gitattributes') }}`——LFS 文件集稳定时命中率高
  3. **restore-keys**：`lfs-${{ runner.os }}-` 前缀匹配——`.gitattributes` 变更但 LFS 文件集不变时部分命中
  4. **保留 `git lfs install --force` + `git lfs pull`**——缓存恢复后 pull 跳过已下载
  5. **任务承载**：[tasks/T06-plan.md §2](../../tasks/T06-plan.md) 11 项 + 实测流量对比
- **流量实测（commit 落地后）**：
  - 第一次 push：~1 GB（cache 未命中——baseline 等价）
  - 第二次 push：~7 MB（cache 命中——节省 ~99%）
- **影响范围**：ci.yml（7 个 engine test job）+ heavy-tests.yml（1 个）——composite action 自动惠及所有调用方
- **风险**：
  - cache 7 天无访问失效（接受：每周一次全量 vs 每次 push 全量，仍显著优化）
  - .gitattributes 变更 key 失效（restore-keys 前缀匹配提供降级）
  - cache 失败默认 warning 而非 error——`git lfs pull` 仍能下载
- **依据**：owner 派 agent 排查 + 评估后拍板"启用 LFS 缓存"

---

## T06 同步登记（2026-08-21 · setup-bun action.yml LFS cache 启用）

- **类型**：修正
- **依据**：D18 决策 + T06 owner 拍板
- **内容**：`.github/actions/setup-bun/action.yml` 加 `actions/cache@v6` 步骤缓存 `.git/lfs/objects/`；cache key 用 `${{ runner.os }}-${{ hashFiles('.gitattributes') }}`；保留 `git lfs install --force` + `git lfs pull`
- **流量实测**：T06 前 ~1 GB/次 → T06 后 ~7 MB/次（节省 ~99%）
- **影响范围**：ci.yml 7 个 engine test job + heavy-tests.yml 1 个 job
- **错误修正（owner 反馈 2026-08-21）**：T06 一开始误创建 `narrative/ci-infra.md`（横向档案不该有 narrative 绑定）——已撤回。**§4.10 D14 物理绑定纪律明确**：narrative/ 层**只绑物理文件**（如 05-process.md ↔ narrative/05-process.md），**横向档案不需要 narrative 绑定**——横向档案本身就是聚合层，"绑定对象"是主题而不是单文件
