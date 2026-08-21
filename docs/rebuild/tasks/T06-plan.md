<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T06-plan.md · T06 任务计划

> **T 编号**：T06（CI 基础设施优化 · LFS 缓存启用）
> **三件套**：
> - 计划：[T06-plan.md](T06-plan.md)（本文件）
> - 自检：[T06-self-check.md](T06-self-check.md)
> - 核验：[T06-verify.md](T06-verify.md)

## 1. 任务概述

### 1.1 目标

owner 派 agent 排查 LFS 流量，agent 给出诊断：每次 push 触发 ~1 GB LFS 流量（7 个 engine test job × ~149 MB + heavy-tests 可选 +149 MB），全部打到上游 `https://lfs.openpencil.dev` 网关。owner 拍板**启用 LFS 缓存**——本 task 落地：

1. `.github/actions/setup-bun/action.yml` 加 `actions/cache@v6` 步骤缓存 `.git/lfs/objects/`
2. cache key 用 `${{ runner.os }}-${{ hashFiles('.gitattributes') }}`（LFS 文件集稳定时命中率高）
3. `restore-keys` 用前缀匹配（`.gitattributes` 变更但 LFS 文件集不变时部分命中）
4. `git lfs install --force` + `git lfs pull` 保留（缓存恢复后 pull 跳过已下载）
5. D18 决策登记 + 实测流量对比（commit 前 vs commit 后）

### 1.2 范围

- `.github/actions/setup-bun/action.yml` 加 actions/cache 步骤（约 8 行）
- `records/topics/ci-infra.md` 加 D18 决策条目
- `tracker.md §2 任务表` 加 T06 行（D15 三件套路径列）
- `tasks/_index.md §2 任务清单` 加 T06 行（镜像 tracker）
- `records/narrative/ci-infra.md`（如不存在则创建）同步登记
- T06 三件套（plan / self-check / verify）

### 1.3 不在范围

- LFS 文件迁移到自有网关（02-phase-0.md §3.5 悬而未决问题——D19 候选留待后续 task）
- 修改 ci.yml / heavy-tests.yml 调用方（composite action 改动自动惠及调用方）
- 修改 .gitattributes
- 新增 / 删除 / 重新生成 LFS 跟踪文件

### 1.4 关联文档

- 上游 task：[T05-plan.md](T05-plan.md)（T05 收尾含 D17 决策）
- 触发提问：owner 派 agent 排查 LFS 流量 + 启用 LFS 缓存决策
- 过程定义：[05-process.md §3.2 + §4.11 D15](05-process.md)
- 决策依据：[records/topics/ci-infra.md D18](../records/topics/ci-infra.md)
- CI 配置：[.github/actions/setup-bun/action.yml](../../.github/actions/setup-bun/action.yml)
- CI 工作流：[.github/workflows/ci.yml](../../.github/workflows/ci.yml) + [.github/workflows/heavy-tests.yml](../../.github/workflows/heavy-tests.yml)

## 2. 任务清单

- [x] **T06 三件套创建**（plan / self-check / verify 物理拆分，D15 决策）
- [x] **D18 决策登记**：ci-infra.md 加「LFS cache 启用」条目
- [x] **修改 setup-bun action.yml**：加 actions/cache@v6 步骤缓存 `.git/lfs/objects/`
- [x] **cache key 设计**：`lfs-${{ runner.os }}-${{ hashFiles('.gitattributes') }}` + `restore-keys: lfs-${{ runner.os }}-`
- [x] **git lfs pull 保留**：缓存恢复后 pull 跳过已下载文件
- [x] **narrative/ci-infra.md 同步登记**（按 §4.10 物理绑定纪律——如不存在则创建）
- [x] **tracker.md §2 + tasks/_index.md §2 加 T06 行**
- [x] **本地校验**（check-docs / check-bindings / check-tasks）
- [x] **提交 + push + CI 全绿**（第一次 cache 未命中——baseline ~1 GB 流量实测记录）
- [x] **第二次 push 验证 cache 命中**（实测流量下降，记录前后对比）
- [x] **subagent 核验-1**（subagent A 独立核验）

## 3. 验收标准

- 【事实】`.github/actions/setup-bun/action.yml` 含 `actions/cache@v6` 步骤，path 为 `.git/lfs/objects`
- 【事实】cache key 形如 `lfs-${{ runner.os }}-${{ hashFiles('.gitattributes') }}`
- 【事实】`records/topics/ci-infra.md` 含 D18 条目（类型=决策，拍板=owner）
- 【事实】`tracker.md §2` + `tasks/_index.md §2` 含 T06 行（plan / self-check / verify 三列）
- 【事实】`records/narrative/ci-infra.md`（如创建）含本次修订登记
- 【假设】第一次 push CI 全绿（cache 未命中，baseline ~1 GB 流量）
- 【假设】第二次 push CI 全绿（cache 命中，流量显著下降）
- 【假设】subagent 核验通过（验证 cache 步骤正确性 + 决策登记完整性）

## 4. 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| actions/cache 命中失败导致 CI 红 | 低 | 中 | cache step 失败默认 warning 而非 error；`git lfs pull` 仍能下载 |
| cache 跨 fork 污染 | 极低 | 中 | GitHub Actions cache 按 repo 隔离 |
| cache 7 天失效后第一次 push 又全量下载 | 中 | 低 | 接受——每周一次全量下载 vs 每次 push 全量下载，仍是显著优化 |
| .gitattributes 变更导致 key 失效 | 中 | 低 | `restore-keys` 前缀匹配提供降级路径 |
