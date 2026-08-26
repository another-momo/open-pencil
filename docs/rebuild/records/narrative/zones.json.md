<!--
  写作纪律：事实须附核验命令+日期，否则【假设】。本文保留当前态，不保留修正历史。
  详见 docs/rebuild/05-process.md §4。
-->

# narrative · zones.json

> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent
> **关联任务**：T32（zones 边界纠正 + check.ts 机制改造）

## T32（2026-08-26） · zones 边界纠正 + check.ts 机制改造

### 边界事实（实测 2026-08-26）

29 个 ownedFile 与上游 88c10770 字节核对结果：
- **24 条 byte 一致**（含 vector 15 + clipboard/recovery/theme 9 个）：上游存在，本地与上游完全一致 → **转 tarball 模式**
- **5 条上游不存在**（ChatModeSelect / ChatStyleProfileSelect / PiModelsPanel / stock-photo-keys / media-credentials）：本地新建文件，T21/T24/T25 期间引入 → **保留 ownedFile + 新增 patch 标签记溯源**
- **0 条上游不存在但被误归 ownedFile 的纯自有**：核对通过

P62-P82 21 枚 patch 字节核对：
- **18 条 byte 一致** → 从 patches 转 tarball
- **3 条有差异**（P60/P61/P74）：本地实际改动 → **保留 patch**

### 改造前后对照

- 改造前：24 个 byte 一致 ownedFile + 18 个 byte 一致 patch + 5 个真实自有 ownedFile（无 patch 溯源）+ 3 个真实 patch
- 改造后：24+18 = 42 个 tarball + 3 个真实 patch + 5 个真实 ownedFile（带 5 枚 patch 溯源）+ P60/P61 保留

### 三态边界（写入 04-porting-discipline.md §3.x）

- **owned**：纯自有资产
- **follow + patch**：我们改了上游的某个版本
- **tarball**：byte 一致的拷贝，结构化登记（zones.json `upstreamMergeTarball`）

### check.ts 三漏洞根治

- L1：tarball 无注册路径 → `checkUpstreamMergeTarball` 新增白名单
- L2：rename 一致性缺失 → `checkRenames` + `collectRenames` 新增
- L3：上游已删本地残留 → `checkGhostDeleted` 新增
- L4：tarball drift 检测 → `checkDriftTarball` warn 模式新增


## T32 收口（2026-08-26） · 行翻 ✅ + 收口评审 F1-F3

- **收口评审三发现**（owner 要求一次性 review 后修复）：F1 tarball drift 初版 warn 不阻断=门禁削弱，升红（`checkDriftTarball` 并入 violations，实测零 drift 无副作用）；F2 checkGhostDeleted 注释残留已废弃 P103 方案引用，订正指向 04 §5；F3 zones.json $comment 补 upstreamMergeTarball 语义与 P62-P82/P83-P97 缺号说明（前者转 tarball 移除、后者 plan 被 tarball 方案取代未启用）。
- **独立核验**：subagent V1-V5 全 ✅「可以收口」（V1 字节一致 8/8 空 diff；V2 zones.json 实体全对；V3 五函数+drift 升红确认；V4 文档四点全过；V5 门禁 exit 0 全套 + smoke:pi 80 断言 + CI 414d37d8 双链 success）。
- **commit 链**：0fbfd65e（首推，staging 红两处：zones.json 格式 + self-check 占位符）→ 414d37d8（修复，双链 success）→ 73b82c55（收口评审 F1-F3）→ 本 commit（verify 填报 + tracker/_index 行翻 ✅）。
