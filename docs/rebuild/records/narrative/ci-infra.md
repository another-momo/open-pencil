<!--
  写作纪律（改本文前必读）：
  - 本文是 topics/ci-infra.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/ci-infra.md

> **状态**：已建立 | **时间**：2026-08-21 | **核验人**：主 agent
> **物理绑定**：[topics/ci-infra.md](../../topics/ci-infra.md)（一一对应）
> **身份**：本档案持有针对 CI / workflows / zone registry 的物理绑定记录，按 §4.10 D14 物理绑定纪律建立。CI 配置文件本身（`.github/`）不在本档案范围——本档案仅记录"对 ci-infra.md 的修改历史"。

---

## 决策类

## 迁移-N · ci-infra.md 物理绑定档案建立（D14 §4.10）

- **类型**：迁移
- **时间**：2026-08-21
- **依据**：§4.10 D14 物理绑定纪律 + T06 任务清单第 6 项
- **内容**：为 [`topics/ci-infra.md`](../../topics/ci-infra.md) 建立物理绑定 record（`narrative/ci-infra.md`）
- **影响**：ci-infra.md 后续修改触发本档案 append-only 同步

---

## 修正类

## 修正-N · setup-bun action.yml 加 LFS cache 步骤（T06 收尾）

- **类型**：修正（按对象：setup-bun action.yml + ci-infra.md 同步登记）
- **时间**：2026-08-21
- **依据**：D18 决策 + T06 owner 拍板
- **内容**：[`.github/actions/setup-bun/action.yml`](../../../../.github/actions/setup-bun/action.yml) 加 `actions/cache@v6` 步骤缓存 `.git/lfs/objects/`；cache key 用 `${{ runner.os }}-${{ hashFiles('.gitattributes') }}`；保留 `git lfs install --force` + `git lfs pull`
- **影响**：ci.yml 7 个 engine test job + heavy-tests.yml 1 个 job 每次 push LFS 流量从 ~1 GB → ~7 MB（节省 ~99%）
- **CI 配置变更不在本档案直接记录**——本档案仅记录"对 ci-infra.md 的修改历史"；CI workflow 配置文件本身（action.yml）的 diff 在 commit message + narrative/ci-infra.md 修正条目里双重指针

---

## 核验类

## T06 自检确认（2026-08-21）

- **类型**：核验
- **核验人**：主 agent + subagent A（独立核验）
- **范围**：D18 决策 + setup-bun action.yml 改动 + ci-infra.md 登记 + 任务表同步 + 流量实测
- **结论**：通过。详见 [tasks/T06-verify.md §2 逐条核验](../../../tasks/T06-verify.md)
