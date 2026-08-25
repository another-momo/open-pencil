<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T27-self-check.md · T27 自查记录

> **T 编号**：T27（Phase 1 收口后整改 · 代码与机制面）
> **状态**：✅ 已收口（C1-C5 全过，C6 远端 CI 待推送后回填；独立核验见 [T27-verify.md](T27-verify.md)）

## 1. 处置结论（C1 三分法全覆盖）

交办清单 32 条（A1-A24 / B1-B3 / C1-C5）全部闭环：

- **证实并改进 24 条（A1-A24）**：逐条落点见 [T27-plan.md §3.1](T27-plan.md)；实施证据为工作树 diff（`git diff --stat`：32 文件 +551/-646）与 §2 门禁实录
- **证伪/已消解 6 条**：见 [T27-plan.md §3.2](T27-plan.md)，每条附实证命令（读盘 / git diff 0 行 / grep）
- **报送 owner 7 组**：见 [T27-plan.md §3.3](T27-plan.md)，事实已核实、建议已写明、代码未动

## 2. 门禁实录（C3，2026-08-25 本机实跑）

| 门禁 | 结果 | 备注 |
|---|---|---|
| `node_modules/.bin/tsgo --noEmit` | ✅ | exit 0 |
| `bun run lint`（oxlint） | ✅ | 0 error（3 个 pre-existing max-lines 警告） |
| `bun run check:vue`（vue-tsc ×2） | ✅ | |
| `bun run check:zones` | ✅ | 51 modified all registered / 251 added owned / 1014 deleted registered |
| `bun run check:docs` | ✅ | 39/39（R1-R5） |
| `bun run check:bindings` | ✅ | 60 文件变更全绿（含 A17 修正后的删除方向语义） |
| `bun run check:tasks` | ✅ | 命中大改动四条规则，T25 指针解析正常（HEAD 代理口径） |
| `bun run check:i18n` | ✅ | harnessThinking→piThinking 改名后 locale 同步 |
| `bun run check:monorepo` / `check:arch` / `test:type-shapes` / `test:tools` / `test:dupes` / `check:deps` | ✅ | knip 4 项 pre-existing latent 经白名单收口（报送 owner 项） |
| `bunx oxfmt --check`（format 脚本口径路径集） | ✅ | 1991 文件全绿；raw 全仓扫的 179 处偏差全在 format 脚本口径外（上游文件） |
| `bun run check:audit` | ⚠️ 环境受限 | registry 404，干净基线同态复现（与改动无关，交 CI） |
| `bun run check:secrets` | ⚠️ 环境受限 | 本机无 gitleaks/go——A7 改动后打印 SKIPPED exit 0（CI 真扫） |
| `format:check` 聚合 | 结构性必红 | 净树判据 + 脏工作树（报送 owner 口径缺陷项） |

## 3. 冒烟回归（C4）

`bun run smoke:pi`（本任务新增正式入口）：t22 target 6 + history 12 + t23 sessions 14 + t24 prompt-assembly 27 = **59 断言全过**（2026-08-25 实施 subagent 实跑；主 agent 收口复跑见 verify）。

## 4. 主 agent diff 抽查实录（C2）

逐文件过 diff 的重点结论：

1. **service.ts**：queue rejection 接力注释完整（rejected 队列跳过机理写明）；abort 带 running 门 + 防御 catch（注释引 pi abort 语义出处 agent-session.d.ts:433）；index 原子写 tmp+rename
2. **server.ts**：413/400 分流；`res.on('close')` 带 writableEnded 守卫不误伤正常收尾；只读路由收编 handleReadonlyPiRequest（500 兜底 + oxlint complexity 一并解）
3. **vite-plugin.ts**：复活带 3 次退避 + 健康清零 + spawn error 视同崩溃；stopChild 主动回收不复活（child !== spawned 判定）
4. **transports.ts**：ensureSeq 序号双处过期判定（含 resetChat 交错注释）；resetChat await onSessionReset
5. **ChatPanel.vue**：sendMessage 吞错实证注释（ai SDK AbstractChat.makeRequest）后按 status==='error' 回填草稿；Continue 死 UI 整块删除
6. **catalog.ts**：纯类型契约模块，零运行时 import，注释说明双形状逃逸史（kimi M-4）
7. **provider-admin.ts**：models.json 校验 fail-fast 且文案只含路径/字段名；runtime 初始化失败释放死 promise（pending.catch 自清缓存）
8. **bindings.ts**：[no-record] 改提示性标记 + 删除方向显式检查（注释承认新旧语义差异，fail-safe 方向）
9. **docs.ts**：R1/R2/R3 锚定前 30 行首个连续引用块（不能钉死行号的理由注释在案）
10. **steiger**：补注册 5 条零违规 + 2 条启用即崩修复（缺导入 / matchAll 缺 g flag）；3 条存量违规挂起注记（17/4/1 处，专项整改非本任务）

## 5. 已知边界

1. A2 断连取消为代码级验证（server close→abort 接线 + running 门）；端到端 token 取消实证需活模型烧 token，未做（本机有 key-env 但实证设计未纳入本批冒烟）
2. smoke:pi 的 history/sessions 两套件依赖本机既有 .openpencil/pi-sessions 会话文件作 fixture——新机/CI 首跑前置失败（已报送 owner）
3. steiger 3 条规则存量违规（22 处）挂起未修，配置内注释明示
4. A24 dev 日志清理是本机动作（.openpencil/ gitignored），无入库面
