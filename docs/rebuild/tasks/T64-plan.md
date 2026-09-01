<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T64 计划 · CI 门禁分层：GHOST 窗口规则改 drift 雷达

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 核验 subagent
> **拍板**：owner 2026-09-01（T63 根因分析后）：外生移动靶（上游活动窗口）不应拦 push——漂移检查改雷达，push gate 只留静态规则

## 1. 背景与方案

T63 实证：GHOST 规则（check.ts checkGhostDeleted，T32 L3）扫 `merge-base..upstream/master` 窗口内上游删除，CI 现拉上游（ci.yml:113-116）→ 上游任何删除都在我们零改动时转红 push CI（run 33460844556 实例）。规则价值真实（根治 T10 类漂移，T63 亦由其发现），但接错层级——门禁输入必须可控。

**落法**（gate/radar 分层）：

1. `tools/zone-registry/src/check.ts`：GHOST 规则收进 `--drift` 旗标（缺省不执行；`--drift` = 全集 = 静态 + 窗口规则）；usage 头注与函数头注定谳。
2. `package.json`：`check:zones:drift` 脚本。
3. `.github/workflows/upstream-drift.yml`（新建）：nightly cron + workflow_dispatch → fetch upstream → `check:zones:drift` → 失败经 actions/github-script 自动建 issue（标题去重），body 带 run 链接与处置 SOP（T63 实例）。雷达输出 = 下轮 upstream 合并备料清单。
4. `ci.yml`：rebuild-discipline 的 Zone registry purity 步骤保持 `check:zones`（静态），加注释指向分层。
5. zones.json：ownedFiles += 新 workflow 文件；P32 扩注（task T64）。

## 2. 不做清单

- 不动 GHOST 规则本体语义（豁免面/窗口算法原样）；不动其他静态规则。
- 不做 bot 自动处置 PR（增强项，观察雷达噪声后再立项）。
- 不删 T63 tarball 白名单（drift 雷达仍校验其 byte 一致，R-drift 规则不变）。

## 3. 验收标准

1. `bun run check:zones` exit 0（静态）；`bun run check:zones:drift` exit 0（含 GHOST，当前窗口干净——T63 已登记）。
2. 阴性探针：临时在上游已删路径造文件 → drift 模式报 GHOST、静态模式不报该条（探针文件即删）。
3. zones.json 登记带 T64 指针；九门禁不回退；CI push 绿。
4. workflow YAML 合法（actionlint 口径人工核——无 actionlint 门禁，靠核验 agent 走查 + 下次 schedule/dispatch 实证）。

## 4. 红线

- check:zones 默认行为变更仅限 GHOST 一条规则；其余规则集合与顺序不动。
- workflow 权限最小化（contents:read + issues:write）；persist-credentials: false。
