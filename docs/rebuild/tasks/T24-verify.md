<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T24-verify.md · T24 独立核验记录

> **T 编号**：T24（Phase 1-pi 实施 · prompt 装配）
> **状态**：✅ 核验通过（2026-08-24 独立 subagent 执行，HEAD=a84093b3，结论「可以收口」）

## 核验项（预审自 [T24-plan.md §2](T24-plan.md) 验收清单 C1-C6 派生）

| #   | 核验项                                                                                | 结果 | 证据节 |
| --- | ------------------------------------------------------------------------------------- | ---- | ------ |
| V1  | 代码与自述一致（D1-D7 落地形态：三段装配、extension 注入、请求级 chatMode、载荷最小） | ✅   | §V1    |
| V2  | 可运行验证（装配冒烟全绿 + lint/type/zone/arch gate）                                 | ✅   | §V2    |
| V3  | 证据链合理性（探针链式语义、断言非恒真、抓包反向断言、降级页缓存隔离）                | ✅   | §V3    |
| V4  | T22/T23 回归不破（历史回填、会话族谱、模式切换后回填仍正确）                          | ✅   | §V4    |
| V5  | 边界登记完整性（plan §1.4 不做项、overlay 下轮生效、工具缺口登记）                    | ✅   | §V5    |
| V6  | 卫生（无 fixture 改动、无密钥、无本机残留入库、上游资产移植标注来源）                 | ✅   | §V6    |

**总结论：可以收口。** D1-D9 全部如述落地，C1-C6 全部经独立复跑实证（后端装配冒烟 27/27、浏览器 mode-overlay-bind 17/17、回归 12+6+14+15+19 全绿、lint/typecheck 0 错），边界无偷跑、卫生无违规。唯一新发现：装配冒烟的进程清理在 Windows+bun 下未真正杀死子进程（详见 §V2 附记，已登记 [T24-self-check §3.3-7](T24-self-check.md)，不打回级——冒烟为验证工具非交付代码，不影响任何断言结论）。

## §V1 代码与自述一致 ✅

逐条核对 D1-D9 全中（2026-08-24 源码比对）：

- modes.ts 注册表两模式声明齐（ui=现 system-prompt.md + acceptsProfile:false；marketing=base+工作流段+acceptsProfile:true，modes.ts:34-47）
- ui 钩子确零注入——service.ts:169 `assembled === event.systemPrompt ? undefined : ...`，探针 byte 级相等实证
- 模式切换先 `await existing.queue.catch()` 再 dispose 再删缓存（service.ts:250-252），同 sessionId 经 SessionManager.open 重建
- overlay 复刻上游 brand-overlay.ts 输出形状（逐行比对上游文件，仅 re-pick 文案指路改动，self-check §3.2-4 已登记）
- manifest 脱敏：toBrandManifest 剥 markdown（brand/index.ts:90-97）
- 载荷仅 chatMode+pickedProfileId（document-key.ts:48-49、transport.ts:40-41）
- 移植两 md 与上游 diff 仅头部注释替换+末尾换行，标注齐全；config.yaml 与上游仅空白行尾差异（格式收敛），loader 头部有来源标注

## §V2 可运行验证 ✅

2026-08-24 独立复跑：

- `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` → 27/27（exit 0）
- `bun run lint` → 0 errors（3 条 max-lines 警告均在 props-overrides.ts，既存无关）；本机未遇 oxlint 内存报错
- `bun run typecheck`（tsgo+vue-tsc×2）→ exit 0

**附记（新发现，不打回级）**：prompt-assembly-smoke 的进程清理在核验机失效——绿色运行结束后两个后端进程仍在监听（疑似 bun-on-Windows 下 kill 后 exit 事件虚假置位跳过 taskkill 兜底分支）。核验时已手动 taskkill 清掉。孤儿积聚正是此前顶爆 oxlint 的已知根因，建议 T25 或冒烟维护时把 stop() 改为「kill 后按端口/pid 实证复查」。已登记 [T24-self-check §3.3-7](T24-self-check.md)。

## §V3 证据链合理性 ✅

- 探针链式语义实证：runner.js emitBeforeAgentStart 按登记序传 currentSystemPrompt，探针在装配 extension 之后注册，读到的即最终注入值；agent-session.js else 分支复位亦证实 ui 零粘连
- 无「断言恒真」：ui 断言是严格全等（===uiBaseWithCwd）；模式切换后探针必须回 ui 基底，若 run 未发生探针仍留 marketing 内容必失败；index/JSONL 为字符串相等+前缀校验
- C4 抓包含反向断言（无 markdown/types 段/applicableTo）
- manifest 失败页用 browser.newPage 全新 context，无 localStorage/HTTP 缓存干扰，route.abort 在网络层拦截
- 唯一偏软处：JSONL「追加」断言用 `length>=`，承载力弱但由同组 index 不动+探针相等兜底

## §V4 回归不破 ✅

2026-08-24 独立复跑（两服务在跑：7700 health ok、1420 200）：

- 后端：t22/history-smoke 12/12、t22/target-smoke 6/6、t23/sessions-smoke 14/14
- 浏览器：t22/bind-smoke 15/15、t23/sessions-bind-smoke 19/19、t24/mode-overlay-bind-smoke 17/17（含流式禁用、刷新持久化、manifest 失败降级全链实证）

## §V5 边界登记完整性 ✅

- grep src/app/ai/pi-backend 无 SQLite/CRUD/brief 原语（read_brief 仅作为营销段文本提及，属 §3.3-1 登记缺口）
- server.ts 无 brand 写路由
- `git diff --stat src/app/ai/chat/` 为空（ToolLoop 零触碰，旧 system-prompt.md 未动）
- zones.json 仅新增两组件 ownedFiles + gitleaks P43 登记
- §3.3 六条边界与代码实况逐条相符

## §V6 卫生 ✅

- `git show --stat HEAD~1 HEAD` + 全 diff：tests/fixtures 五个 LFS 文件零改动（最后触碰于历史 commit）
- diff 内唯一 key 形态为 sk-or-test-key-12345，已入 .gitleaks.toml allowlist（zones.json P43 登记）
- src/docs 提交文件无 `C:\Users`/`D:\Desktop` 绝对路径
- yaml 依赖升级（§3.2-5）与 options bag 重构（§3.2-1）等偏差均如实登记
