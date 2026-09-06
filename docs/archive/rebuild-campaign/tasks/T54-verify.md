<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T54 核验 · generate_image 管线移植 + 凭证链新建

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 | **负责人**：独立核验 agent（只读）
> **核验对象**：分支 rebuild/mode-arch 未提交改动；验收真源 T54-plan.md §3；规格真源 S3-tool-contracts-spec.md §4/§9；探针 spikes/probes/sp/a1-images-contract.mjs（SP-a1）与 b-rpc-timeout.mjs（SP-b）

## 1. 核验范围

T54-plan §3 验收标准逐条核验（2026-09-01，全部 unpiped 直读退出码或重定向文件实读）。实现文件集：packages/core/src/tools/fork/image-gen/{requests,apply,history,tools,index}.ts + fork/placement.ts（T52 共享助手，apply 已换引）、src/app/ai/pi-backend/image-gen/{presets,credentials,provider-dmx,bridge-call,generate,routes,client}.ts、src/app/ai/pi-backend/{server.ts,service.ts} T54 段、packages/mcp/src/browser-rpc.ts（超时 env）、src/components/settings/{SettingsDialog.vue,provider/ImageGenKeysSection.vue}、src/app/i18n/fork/{index.ts,locales/en.ts,locales/zh-cn.ts}、tests/engine/rebuild/image-gen/ 八件。

## 2. 验收核验

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | 管线四分：requests 纯函数校验（16px 对齐/边长/纵横比/像素钳制；空数组/缺尺寸拒绝） | ✅ | requests.ts L126-185（SIZE_MULTIPLE=16/MAX_EDGE=3840/MAX_ASPECT_RATIO=3/MIN/MAX_PIXELS）；requests.test.ts 19 例全过（含 1000x500→1168x576 保宽高比抬升钉扎、空数组/非法 JSON/缺 prompt/缺尺寸拒绝、hd→auto 别名、尾部垃圾打捞） |
| V2 | apply 编排：protectedRedirect / 参考图三规则 / [image N] 错位防护 / 目标解析 | ✅ | apply.ts L133-145（redirect 软保护）、L88-119（三规则 + teach 提示）、L170-174（错位防护响亮报错）、L204-236（目标解析 + 新帧放置）；apply-references.test.ts 10 例全过（含 exportImage 不可用分支、普通 replace_id 直用目标） |
| V3 | snapshotBeforeOverwrite：仅 IMAGE fill + 同 hash 去重 | ✅ | history.ts L215-216（无 IMAGE hash → undefined）、L223-226（latestHash 同 → undefined）；history.test.ts 6 例全过（纯色不快照/同 hash no-op/hash 变 → v2/克隆剥外来标记/营销根锚定 x=2180 实测） |
| V4 | 双段拓扑：生成 HTTP 在 pi-backend 进程（不经 7600 桥）；落图经桥 image_gen_begin/commit | ✅ | generate.ts：runBeginPhase 串行经桥（L115 for-await）、runGeneratePhase 并行 provider 直发（L146 Promise.all，无桥）、runCommitPhase 串行经桥（L173）；provider-dmx.ts 原生 fetch 直发（L148/L167）；orchestration.test.ts 事件序列钉扎 `['begin:0:start','begin:0:end','begin:1:start','begin:1:end']`（5ms 异步间隙，并行必交错——断言非恒真） |
| V5 | 凭证不出后端：key 不进桥 payload/工具 schema/不回传 | ✅ | `grep -rn 'apiKey' packages/core/src/tools/fork/image-gen/ src/app/ai/pi-backend/image-gen/{bridge-call,generate,routes,client}.ts`：apiKey 仅出现在凭证管理面（client POST → routes → store），桥调用与编排面零命中；orchestration.test.ts「桥 payload 与工具结果零 key」断言 SECRET_KEY 不出现在 JSON.stringify(calls)/result；generate_image schema 仅 `requests` 一参（generate.ts L218-223） |
| V6 | 路线乙：DMX GPT-image-2 自写核心（/images/generations + /images/edits）；pi-ai generateImages 仅接口槽 | ✅ | provider-dmx.ts 文生图 JSON POST /images/generations、图生图 multipart /images/edits（image[] 带文件名）；扩展槽 = ImageGenProvider 接口（requests.ts L64-73）+ deps.createProvider 注入点（generate.ts L53/L232-235），本任务不实现（与 T54-plan §2 不做清单一致） |
| V7 | 凭证链：三键 + 进程级注入 + 设置 UI 预设下拉+单 key + 空 key 清除 + 默认无第三方中转 + status 不回 key + 原子写 0o600 | ✅ | credentials.ts：三键落盘 .openpencil/pi-agent/image-gen.json，tmp+rename 原子写 mode 0o600（L81-87）；空/全空白 key → clear()（L100-103）；status() 只回 configured/presetId/baseUrl/model（L123-132）；presets.ts L36 DEFAULT='openai'（api.openai.com，非中转）；server.ts L295-298 单实例 store 同供路由与 service（进程级注入）；ImageGenKeysSection.vue 预设 select + password 单输入 + 保存/清除；credentials.test.ts 9 例全过（含空 key 删文件、未知预设拒绝、跨进程读回） |
| V8 | 超时：OPENPENCIL_RPC_TIMEOUT_MS 贯穿桥调用链；缺省 ≥240s+余量（SP-b）；生图 HTTP 独立 240s 基线 | ✅ | browser-rpc.ts L15-18：缺省 20s→300s，rpcTimeoutMs() 调用时读取（SP-b 钉的模块加载期常量已改为运行时读取）；sendRPC L187 每次调用取最新值；bridge-call.ts L21-28：fetch 超时 = 桥超时 + 60s 余量；provider-dmx.ts L29-33：IMAGE_GEN_DEFAULT_TIMEOUT_MS=240_000 + OPENPENCIL_IMAGE_GEN_TIMEOUT_MS 覆盖 + AbortSignal.timeout(L127)；rpc-timeout.test.ts 5 例全过（缺省 ≥270s 断言、env 设置→生效、非法回退、两缺省一致钉扎） |
| V9 | 并发放置竞态：批量 begin 每次重读 bounds，测试真实还原竞态 | ✅ | apply.ts L218 resolveOutputTarget 内每次调 findPlacementPosition（读当前页 union bounds，placement.ts L43-48）；generate.ts begin 串行（V4）；placement-race.test.ts 用真 SceneGraph + 真 image_gen_begin execute 连续三次 begin，断言第二帧 x ≥ 首帧 x+width、第三帧持续右移（若 bounds 读取被提升循环外则三帧重叠、断言必红——回归钉扎有效） |
| V10 | service 装配：createImageGenTool 进 customTools，单实例凭证 store 由 server.ts 注入 | ✅ | service.ts L202-207 customTools = [...createOpenPencilTools(...), createImageGenTool({credentials: imageGenCredentials, target})]；server.ts L295-298 创建单实例并同时挂路由（L318-321 /api/pi/image-gen/credentials，置于鉴权之后、/api/pi/ 管理面前缀之前）；vite-plugin.ts L182-188 '/api/pi' 前缀 proxy + 统一补 Bearer 头（前端 client.ts 同源 fetch 可达） |
| V11 | 设置 UI + i18n：media 段挂载、双 locale 键齐 | ✅ | SettingsDialog.vue L15/L162 media 段挂 ImageGenKeysSection（zones.json 已登记 ownedFiles，`git diff tools/zone-registry/zones.json` 见 P 条目）；en.ts L45-56/zh-cn.ts L22-33 imagegen 域；`bun run check:i18n`「All locale files are in sync」exit 0 |
| V12 | 旧六键 localStorage 体系不迁 | ✅ | `grep -rn localStorage` 于 ImageGenKeysSection.vue + pi-backend/image-gen/ + core image-gen/ 零命中；key 直送后端凭证面，前端不持久化 |
| V13 | §3.1 套件全绿 | ✅ | `bun test tests/engine/rebuild/image-gen/`（2026-09-01，unpiped）：68 pass / 0 fail / 8 文件，exit 0 |
| V14 | §3.2 桥超时读取路径测试钉扎 | ✅ | rpc-timeout.test.ts 五例（见 V8），含「两处缺省不得漂移」（BRIDGE_RPC_DEFAULT_TIMEOUT_MS === DEFAULT_RPC_TIMEOUT_MS） |
| V15 | §3.3 rebuild 全绿不回退 + 九门禁 + 全量回归失败数不增 | ✅（附 I3 边界注记） | `bun test tests/engine/rebuild/`：172 pass / 0 fail / 19 文件，exit 0（T51 基线 26/26 → 172/172，失败数 0 不增）。门禁逐个 unpiped 实跑 exit 0：check:zones（81 modified/451 added/1019 deleted 全登记）、check:docs、check:tasks、check:bindings、check:monorepo、check:i18n、check:arch（steiger 零违规）、check:packages、check:deps、format:check、test:tools、test:type-shapes、test:dupes（jscpd 0 克隆）、build:packages、tsgo --noEmit、check:vue、lint（0 error；13 个 max-lines warning 均在非 T54 既有文件）。check:audit 环境性 404、check:secrets 本机跳过（gitleaks 未装）——见 I4。全量 quick 口径：2775 tests/447 文件跑完，85 fail 逐一对账基线无一可归 T54（构成分析见 I3） |
| V16 | §3.4 凭证 mock 测试纳入 CI 常跑套件 | ✅ | 八件在 tests/engine/ 下；`bun tools/unit-tests/src/list.ts all` 实跑命中 image-gen 8 文件；ci.yml L222-233 engine tests 步以该清单跑 `bun test`（D34 闭环） |
| V17 | §3.5 CI 逐 push 口径绿 | ➖ 不在本地核验能力内 | 评审对象为未提交改动，CI 未跑过本批；本地门禁全绿（V15）为前置证据，push 后由 CI 实证 |
| V18 | 红线：不引入新 npm 依赖；凭证不打印不落盘他处 | ✅ | `git diff package.json bun.lock` 零输出（DMX 走原生 fetch/FormData/Blob）；provider-dmx.ts 错误文案取自响应体 error.message（L69-88），provider-dmx.test.ts「错误信息/请求不带 key 泄露路径」断言 401 错误不含 key 本体 |
| V19 | 冒烟：pi 后端装配含 generate_image 可启动 | ✅ | `bun run smoke:pi` 五件汇总 6+12+14+30+19 passed / 0 failed（实读汇总行）——t22 target-smoke 实际 boot service（customTools 含 createImageGenTool 装配路径），后端就绪 + 工具集断言通过 |

## 3. 问题清单（按严重度）

- **I1（低 · 验收措辞与路线乙的偏差，已成文）**：T54-plan §3.1 字面写「provider mock 请求形状对照 SP-a1 契约」，但 SP-a1 钉的是 pi-ai openrouter-images 扩展槽契约（chat.completions 形状）；路线乙（plan 头 + T47 登记）定 DMX 自写 provider 为核心，provider-dmx.test.ts 钉的是移植源 providers.ts 的 /images/generations|edits 形状（契约字段全集 toEqual 钉扎）。实质验收意图（mock fetch 钉请求形状进 CI）已达成，测试头注已声明偏差并指向报告偏差节；建议收口时把 §3.1 措辞修为「对照移植源 DMX 契约（SP-a1 留作扩展槽契约）」。
- **I2（低 · 集成面可见性）**：image_gen_begin/image_gen_commit 经 FORK_TOOLS 进 ALL_TOOLS 并被 createOpenPencilTools 全量暴露给 AI（pi-backend/tools.ts L216-218），仅靠 description 的 INTERNAL 字样软约束；begin 结果含 base64 参考图，模型若直调会撑上下文。桥端执行需要 ALL_TOOLS 登记（tool-handlers.ts 以 ALL_TOOLS 分发），注册本身必需；是否对 AI 隐藏归 S3 §9 工具可见性（workflow 白名单）集成期裁决，不阻断本任务收口。
- **I3（低 · 全量 quick 口径失败构成，全部可归既有环境类）**：`bun run test:unit:quick` 第三次尝试完整跑完（733s）：2775 tests / 447 文件 / 85 fail / 8 errors / exit 1（前两次尝试在本机资源争抢下中途无汇总中断，已清理自身残留 bun 进程后第三次成跑）。85 fail 去重 80 条，与 T49 基线（doc/t49-failures.txt，73 条）对账：新增 8 条中——3 条（BrowserRpcBridge sendRPC never-connects / fig roundtrip source metadata / resize+export integration）在 t41/t42/t45-t49 历次回归日志中均有出现记录（本机负载型抖动类；sendRPC 例单跑 10016ms 精确通过）；5 条为 T52 create_brief/placement 测试在全套件进程内撞 `window is not defined`（figma-api scrollAndZoomIntoView 的 IS_BROWSER 分支——同类错误在 t41/t42 基线各出现 10 次，属既有 quick 套件跨文件环境污染类），该 5 例在本任务口径隔离跑（tests/engine/rebuild/ 172/172）全绿。**T54 触碰面（image-gen 八件、mcp browser-rpc、settings、i18n）零失败**：browser-rpc.test.ts 的 2 条 ws-guard 失败与 T49 基线逐字相同（T54 改动前即失败），sendRPC 例为上述抖动类。结论：quick 口径失败数 73→85 的增量全部落在既有环境类与 T52 测试的环境敏感面，无一可归 T54 改动。
- **I4（信息 · 环境受限门禁）**：check:audit 报 `audit request failed (status 404)`（registry 端点问题；package.json/bun.lock 零改动，与 T54 无关）；check:secrets 本机跳过（gitleaks/go 未装，脚本自述 CI 跑真扫）。两项均与 T51 时期环境口径一致。

## 4. 总结论

**通过（PASS）**。T54-plan §3 验收：§3.1 image-gen 套件 68/68 全绿（V1-V9、V13，八件断言均非恒真——串行事件序列/精确帧坐标/契约字段 toEqual/错误文案内容均有区分度）；§3.2 桥超时 env 钉扎齐全（V8/V14）；§3.3 rebuild 172/172 不回退 + 九门禁实跑全绿（V15，check:audit/secrets 环境受限除外，I4），全量 quick 口径 85 失败逐一对账基线、无一可归 T54（I3）；§3.4 CI 常跑纳入实证（V16）；§3.5 属 push 后事项（V17）。红线复核：凭证不出后端（V5/V18，grep + 测试双证）、零新 npm 依赖（V18）、双段拓扑与路线乙落地（V4/V6）、并发竞态修复真实钉扎（V9）。遗留 I1/I2/I3/I4 均为低严重度或环境项，不阻断收口。
