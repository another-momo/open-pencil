<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# Spike 06 · Phase 3 前置探针批（SP-a / SP-b / SP-c / SP-d）

> **状态**：SP-a1 / SP-b / SP-c 成立（2026-08-30 复核绿）；SP-a2 关闭（2026-08-31 owner 拍板路线乙：自写 DMX GPT-image-2 provider 为核心，pi-ai generateImages 留扩展位，探针取消）；SP-d 建议递延至 KV mode 立项
> **执行分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`，从 `rebuild/pi` 83a9687d 拉出）
> **上游依据**：`doc/S4-phase3-plan.md` v2 §2 探针批；`doc/S3-tool-contracts-spec.md` v2 §4
> 陈述纪律：**【事实】**（附核验命令 + 日期）/ **【推断】**（由证据推出）/ **【假设】**（未验证）。

---

## 0. 结论先行

| 探针 | 判定 | 一句话结论 | Phase 3 落点 |
|---|---|---|---|
| SP-a1 生图接口形状 | ✅ 成立 | pi-ai `generateImages` 走 OpenAI 兼容 chat.completions，请求/响应/错误路径全部钉死，可直接封装 | T-A 批资产机制内封装 `generate_image` 工具；超时经 `options.timeoutMs` 可控 |
| SP-a2 真图出图质量 | ✅ 关闭 | 2026-08-31 owner 拍板路线乙：自写 DMX GPT-image-2 provider 为核心（/images/generations + /images/edits），pi-ai 留扩展位；DMX×pi-ai 探针取消 | W2 generate_image 工具层留双后端可插抽象（S4 §7 生图 provider 路线行） |
| SP-b 桥 RPC 超时 | ✅ 定谳 | 桥默认 20s 掐断实证成立；`OPENPENCIL_RPC_TIMEOUT_MS` env 放宽实证成立；框架/fetch 层无额外出厂上限 | dev 链必须配 env ≥ 240s + 余量（S3 §4），否则长任务工具必被掐 |
| SP-c CanvasKit 避头尾 | ✅ 成立 | canvaskit-wasm 0.41.1 的 ICU 断行器自动执行中文避头尾禁则，33 宽度 × 2 locale × 3 夹具 0 违规 | 不需要 prompt 软约束兜底；长图 workflow（T-C2）不写避头尾纪律条款 |
| SP-d KV paper dry-run | ⏸️ 递延 | 建议并入未来 KV mode 立项时再做 | S4 §2 标注可选；本次不动 |

---

## 1. SP-a1 · generateImages 接口形状钉扎

### 背景

17 册 W1-D2 与 S4 v2 定生图接入 S-a 路线 = pi-ai 的 `generateImages`（`@earendil-works/pi-ai` v0.84.2，`./api/openrouter-images` 导出）。接入前必须把接口形状钉死，避免按想象封装。

### 方法与证据

探针：`spikes/probes/probe-sp-a1-images-contract.mjs`（注入 fake fetch 捕获请求 + 合成响应）。
核验命令（2026-08-30，本 worktree 复核绿，14/14 断言）：

```
bun spikes/probes/probe-sp-a1-images-contract.mjs
```

**【事实】** 钉扎结论（另经 2026-08-30 走查 `node_modules/@earendil-works/pi-ai/dist/api/openrouter-images.js` 全文确认）：

1. **传输 = OpenAI 兼容 `chat.completions`**（POST `{baseUrl}/chat/completions`），**不是** `/images/generations`——按 images/generations 写封装会整个跑偏。
2. 请求体：`{model, messages:[{role:'user', content:[{type:'text'}|{type:'image_url', image_url:{url:'data:...'}}]}], stream:false, modalities}`；`modalities = ['image']`，`model.output` 含 `'text'` 时扩展为 `['image','text']`（探针 [2] 实证）。
3. 图像输入以 base64 data URL 内联进 content parts（探针 [1] 回环实证）。
4. 响应解析：取 `choices[0].message.images[].image_url`，**仅 `data:` URL 被解析入列，http(s) URL 静默跳过**（探针合成响应混入 http URL，输出仅 1 张）——消费方不能假设「返回 N 张就有 N 张」。
5. 文本随图返回时落在 `output` 的 `{type:'text'}` 项；`responseId`、`usage`（按 `model.cost` 费率计费）均透传。
6. 鉴权：`options.apiKey` → `authorization: Bearer <key>`；缺失时**不发请求**直接 `stopReason:'error'`，`errorMessage = "No API key for provider: <provider>"`（探针 [3] 实证）。
7. `options.timeoutMs` 存在并传入 OpenAI client timeout——provider 层超时可控，与 SP-b 结论配套（桥 240s、provider 按需）。
8. `options.fetch` 可注入（本探针即依赖此点）——测试与未来的代理/重试层都有落点。

**model 对象必备字段**：`{id, api:'openrouter-images', provider, baseUrl, output:['image'(,'text')], cost:{input,output,cacheRead,cacheWrite}}`。

### Phase 3 影响

- `generate_image` 工具封装直接按上述契约写，无需再探；
- model 注册表需为图像模型补 `output`/`cost` 字段形状；
- 凭证来源归入 T-B 批工具层一并解决（路线乙：DMX key 存取路径；pi-ai 扩展位解锁后即插即测）。

---

## 2. SP-a2 · 真图出图质量（阻塞登记）

**【事实】** 2026-08-30 核查本机凭证面：`~/.openpencil/` 仅含 `brand.db`，无 `pi-agent/auth.json`，环境变量无 OpenRouter key——真图出图无法实测。

**【事实】** 2026-08-31 路线核查：pi-ai v0.84.2 的 `openrouter-images` 是 dist/api 唯一图像模块，传输 = chat.completions + modalities 形状（`dist/api/` 目录 ls 实证无 images/generations 模块）；而旧仓 DMX 用法（`open-pencil/packages/core/src/tools/image-gen/providers.ts:79-217`）= `dmxapi.cn/v1` 的 `/images/generations` + `/images/edits` 形状——两套协议不兼容。

**决定登记（owner 指令，2026-08-31，T47）**：生图走**路线乙**——自写 GPT-image-2 形状 provider（DMX `/images/generations` + `/images/edits`）为当前核心 provider；pi-ai `generateImages`（SP-a1 已钉接口形状）保留为未来可扩展支持项；DMX 不走 pi-ai，DMX×pi-ai 探针取消，本 spike 关闭。W2 `generate_image` 工具层设计须留双后端可插抽象。

---

## 3. SP-b · 桥层 RPC 超时定谳

### 背景

S3 v2 §4 要求长任务工具（生图、批量排版）单调用可能超过 20s。桥层若存在出厂 20s 上限且不可配，整条工具链必须绕行。需回答：上限在哪一层？能否放宽？

### 静态证据

**【事实】**（2026-08-30 走查）：

1. 唯一硬上限在桥：`packages/mcp/src/browser-rpc.ts:11` `const RPC_TIMEOUT = Number(process.env.OPENPENCIL_RPC_TIMEOUT_MS) || 20_000`——模块加载期常量，**env 必须在 import 前设置**（探针据此按模式自spawn子进程）；`:180-183` pending-map 定时器超时 reject `RPC timeout (${RPC_TIMEOUT/1000}s)`，经 `/rpc` 路由（`packages/mcp/src/server.ts:157-170`）以 HTTP 502 返回。
2. 框架层无上限：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session*.js` grep 无任何 setTimeout/AbortSignal/timeout——pi-coding-agent 不对工具调用设墙钟上限。
3. 调用方无上限：`src/app/ai/pi-backend/tools.ts:82` `callBridgeTool` 裸 fetch，无客户端超时（仅连接失败/401 各重试一次，`:90-110`）。

### 动态实证

探针：`spikes/probes/probe-sp-b-rpc-timeout.mjs`（起真 MCP server + 延迟 25s 应答的 mock app；default / override 两模式自spawn）。
核验命令（2026-08-30 复核绿）：

```
bun spikes/probes/probe-sp-b-rpc-timeout.mjs all
```

| 模式 | 结果 | 判定 |
|---|---|---|
| default（无 env） | HTTP 502 `{"ok":false,"error":"RPC timeout (20s)"}` @ 20010ms | ✅ 20s 掐断实证 |
| override（`OPENPENCIL_RPC_TIMEOUT_MS=60000`） | HTTP 200 `{"ok":true,"result":{"slept":25000}}` @ 25010ms | ✅ env 放宽实证 |

### Phase 3 影响

**dev 链（以及任何拉起 MCP server 的入口）必须设置 `OPENPENCIL_RPC_TIMEOUT_MS` ≥ 240s + 余量**（S3 §4 要求），且因为是模块加载期常量，env 要落在进程环境而非运行时赋值。落入 W1 T-A 批 / dev 脚本改动时一并带上；缺了这个，一切长任务工具在 20s 处必断。

---

## 4. SP-c · CanvasKit 中文避头尾（kinsoku）能力

### 背景

长图 workflow 的排版质量依赖避头尾禁则（句号逗号不出现在行首、开括号不出现在行尾）。若渲染引擎不自动执行，就得在 prompt/workflow 里写软约束兜底（不可靠）。需实证 canvaskit-wasm 的 Paragraph 是否内建 ICU 断行禁则。

### 方法与证据

探针：`spikes/probes/probe-sp-c-kinsoku.mjs`（本地字体 `packages/core/assets/AlibabaPuHuiTi-Regular.ttf`，零网络依赖）。
核验命令（2026-08-30 复核绿）：

```
bun spikes/probes/probe-sp-c-kinsoku.mjs
```

**【事实】**：

- 三夹具（A 行首禁则 `。，、！？；：％」』】）》—…·` / B 行尾禁则 `「『【（《‘“` / C 拉丁对照）× 33 档宽度（250..1050px 步进 25 @ fontSize 100）× 2 locale（未设置 / zh-Hans）：**违规 0 处**。
- 防「虚空通过」：危险区相邻断点计数 20 处（B 夹具各 locale 各 10 处）——证明换行确曾落在禁则字符旁，不是扫了个没换行的空区间。
- 实证切片（A 夹具 @ 450px = 4.5em 危险宽度）：行切片为 `「中中中」/「中。中中」/...`——句号若跟随前一行会恰好落行首，引擎主动把断点前移一字，避头尾生效的直接证据。

**【推断】** canvaskit-wasm 0.41.1 的 Paragraph（ICU line breaker）对中日韩文本自动执行避头尾，与 locale 设置无关（两 locale 均 0 违规）。

### Phase 3 影响

- 长图 workflow（T-C2 `longform.md`）**不写**避头尾相关纪律条款，也不需要 prompt 软约束兜底——少一条不可靠约束；
- 排版质量红线的 prompt 侧只保留引擎管不了的部分（层级、留白、对齐），引擎管的断行不重复立法。

---

## 5. SP-d · KV paper dry-run（递延建议）

S4 §2 原列为可选探针。KV（主视觉）设计的纸张/尺寸语义尚无对应 mode 立项——按 PD-16「mode 可用性 = workflow 文件存在」，KV mode 还不存在。**建议递延至 KV mode 立项时再做**，届时 dry-run 才有消费方。本次探针批不执行。

---

## 6. 汇总：探针批对 S4 排期的解锁状态

- SP-a1 ✅ → pi-ai 路线接口形状在案（留作未来扩展位）；当前核心 provider 按路线乙自写（2026-08-31 owner 拍板，见 §2）；
- SP-b ✅ → W1 须带 env 配置改动（≥240s），否则 W3 联调必断；
- SP-c ✅ → T-C2 `longform.md` 内容边界收窄一条；
- SP-d ⏸️ → 不占本次排期。

**探针批整体判定：可以进入 W1 正式推进。**
