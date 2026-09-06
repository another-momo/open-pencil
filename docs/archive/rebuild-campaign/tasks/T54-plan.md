<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T54 计划 · Phase 3 W2/T-B3：generate_image 管线移植 + 凭证链新建

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §4/§9/§10](../../../doc/S3-tool-contracts-spec.md)、[S4-phase3-plan.md §4](../../../doc/S4-phase3-plan.md) T-B3 行、生图路线乙登记（T47：自写 DMX GPT-image-2 provider 为核心，pi-ai generateImages 为扩展位）
> **移植源**：`open-pencil` 仓 feature/agent-backend @ 5d38aa4e：packages/core/src/tools/image-gen.ts（55 行 ToolDef 面）+ image-gen/{apply 263, requests 251, providers 233, history 214}.ts（`wc -l` 实测 2026-08-31）
> **探针依据**：spikes/probes/sp/a1-images-contract.mjs（SP-a1，DMX images 契约实证）、sp-b-rpc-timeout.mjs（SP-b：桥默认 20s kill 实证）——两探针结论先行复读再动手

## 1. 背景与方案

W2 最大单任务。旧生图是浏览器侧工具直调第三方（六键 localStorage 凭证，00 架构级 #1 不迁）；新架构按 S3 §4 重建为**后端持有凭证 + 双段执行**拓扑。

**执行拓扑**（S3 §4，01 B.3 裁决 2）：

- **生成段**：AI 工具 `generate_image` 的 execute 在 pi-backend 进程执行——provider HTTP 走后端自己的 fetch（不经 7600 桥）；凭证三键（key/baseURL/model）进程级注入，存储走 pi-backend 既有凭证面（`src/app/ai/pi-backend/auth.ts`/`provider-admin.ts`/`config.ts` 实测在案，2026-08-31，复用还是扩面由实现期勘察定谳）。
- **落图段**：生成结果（图像字节）经 7600 桥写入画布——core 侧落图逻辑（参考图提取/目标解析/覆盖快照/放置）封装为桥可调的 core 工具。
- **桥超时**：`OPENPENCIL_RPC_TIMEOUT_MS` env 贯穿桥调用链，≥ 生图上限 240s + 余量（SP-b 实证桥默认 20s kill）；生图 HTTP 超时独立设定（240s 基线可调）。冒烟断言进测试。

**管线四分保留**（S3 §4）：requests 纯函数层（尺寸/数量校验）→ apply 编排（protectedRedirect 误传保护 → 参考图提取三规则 + `[image N]` 错位防护 → 目标解析）→ provider → **snapshotBeforeOverwrite**（仅 IMAGE fill 才快照、同 hash 去重）。

**心智模型不变**：references 唯一输入 / replace_id 唯一输出；一次调用默认出 2~3 张候选；全分辨率直出（PD-1）。

**并发放置竞态修复**（00 #10）：批量帧创建循环内**每次重读 bounds**。共享放置助手 `fork/placement.ts` 由并行任务 T52 交付；本任务先行在 `fork/image-gen/placement.ts` 落同签名本地副本，集成期由主 agent 归并换引（两 plan 互记在案）。

**凭证链新建**（S3 §4 逐条）：

- 三键 + 进程级注入；设置 UI 收敛为「服务商预设下拉 + 一个 key 输入」（08 §I 方向）——UI 落 `src/components/settings/` 新面板文件（上游区，集成期登记 ownedFiles）。
- 空 key 清除必须生效（00 #7 旧 bug 不修不搬）；默认不指向任何第三方中转（08 P0-5b）。
- 凭证链 mock 进 CI（D34）：provider 层依赖注入，测试以 mock fetch 钉住请求形状（SP-a1 契约为据）。

**文件布局**（ownedRoots 内，zones.json 零登记）：

| 文件 | 内容 |
|---|---|
| packages/core/src/tools/fork/image-gen/requests.ts | 纯函数请求层（校验/构造） |
| packages/core/src/tools/fork/image-gen/apply.ts | 画布侧编排（参考图三规则/错位防护/目标解析/覆盖快照/批量放置重读 bounds） |
| packages/core/src/tools/fork/image-gen/history.ts | 生成历史（源 214 行语义随迁，存储面适配目标仓） |
| packages/core/src/tools/fork/image-gen/tools.ts | core ToolDef（落图段，桥可调） |
| packages/core/src/tools/fork/image-gen/index.ts | `IMAGE_GEN_TOOLS` 导出 |
| src/app/ai/pi-backend/image-gen/{provider-dmx.ts,service-bridge.ts}（命名实现期可微调） | DMX GPT-image-2 provider 核心 + 后端生成段编排 + pi-ai generateImages 扩展位（接口槽，不实现） |
| src/components/settings/ 新面板（1 文件） | 预设下拉 + 单 key 输入 |
| tests/engine/rebuild/image-gen/*.test.ts | requests/apply/快照去重/并发重读 bounds/凭证 mock 契约 |

## 2. 不做清单

- pi-ai generateImages 扩展位的具体实现（只留接口槽）；stock_photo 移植（后续独立任务）；旧六键 localStorage 体系迁移（明确不迁）； vision 侧信道（后续）。
- 设置 UI 其余服务商面板的重构（只加本工具所需预设收敛）。

## 3. 验收标准

1. `bun test tests/engine/rebuild/image-gen/` 全绿：requests 校验（尺寸/数量越界拒绝）、参考图三规则 + `[image N]` 错位防护、replace_id 覆盖前快照（仅 IMAGE fill + 同 hash 去重）、批量放置循环内重读 bounds（并发竞态回归钉扎）、provider mock 请求形状对照移植源 DMX 契约（/images/generations + /images/edits 字段全集；SP-a1 探针钉的是 pi-ai 扩展槽契约而非 DMX 核心——实测修正）、空 key 清除生效、默认无第三方中转 baseURL。
2. 桥超时：`OPENPENCIL_RPC_TIMEOUT_MS` 读取路径有测试钉扎（env 设置→生效；缺省值 ≥ 240s+余量 或显式报错——以实现期勘察的桥超时现状为准成文）。
3. `bun test tests/engine/rebuild/` 全绿不回退；九门禁全绿；全量回归失败数不增（对照 T51 基线）。
4. 凭证 mock 测试纳入 CI 常跑套件（tests/engine 下即自动入 CI，D34 闭环）。
5. CI 逐 push 口径绿。

## 4. 红线

- 凭证不出后端进程：key 不进桥 payload、不进工具 schema 参数、不打印不落盘他处（沿用 T20 凭证纪律）。
- 不引入新 npm 依赖（DMX 走原生 fetch；frontmatter 解析级需求复用既有 yaml 包先例除外——预期不需要）。
- 并行波次纪律：禁止 commit/push；禁止碰 fork/index.ts、pi-backend/tools.ts 的既有工具装配段（generate_image 的后端特殊装配由主 agent 集成期接线）；禁止改 zones.json/tracker/_index。
