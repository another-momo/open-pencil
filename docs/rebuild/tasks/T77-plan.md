# T77 计划 · image-gen provider 收尾批（P3 response_format 移除 + P7 background 收归 + P6 Seedream）

> 日期：2026-09-02。来源：owner 指令「和这个文档里尚未完成的优化和拓展一起
> 执行 @docs\202609010000-image-gen-provider-review.md」——该文档 P3/P6/P7
> 三项（P0/P1/P4/P5 已随 T66 完工；P2 测试连接已随 T71 裁决移除）。
> 实施 = fast-worker 子 agent（本文件即施工规格）；门禁/三件套/提交 = 主 agent。

## 1. 事实基线（主 agent 已取证，勿重复调查）

- `src/app/ai/pi-backend/image-gen/provider.ts`：`RESPONSE_FORMAT='url'`
  (:110) + T66 P3 注释块 (:101-109)；发送点 :154（multipart）/:179（JSON）；
  background 透传点 :152/:177（`req.background ?? 'auto'`）。
- `extractImageBytes`（provider.ts:49-63）已双格式消费（b64_json 优先、
  url 二次下载）——response_format 对解析路径不承重（测试夹具 B64_RESPONSE
  即 b64_json 响应）。
- 工具 schema `GENERATE_IMAGE_PARAMETERS`（generate.ts:238-300）九字段含
  background (:270-274)；description（1962 字符）不含 background 行，摘除
  不动 description。
- provider 创建点：generate.ts:316-318 缺省工厂硬接 createImageGenProvider；
  `deps.createProvider` 注入点保留。
- 注册表 provider-types.ts 单族 `openai-compatible`；credentials.ts:120 经
  `isImageGenProviderType` 校验——注册表加条目即自动放行。
- UI `src/components/settings/provider/ImageGenKeysSection.vue`（ownedFiles，
  免登记）：下拉直接消费 IMAGE_GEN_PROVIDER_TYPES；placeholder 来自 i18n
  （imageGenBaseUrlPlaceholder / imageGenModelPlaceholder）。
- zones：本任务全部文件位于 ownedRoots（pi-backend/、tests/engine/rebuild/、
  i18n/fork/）或 ownedFiles（ImageGenKeysSection.vue）——**零 P-NN 登记**。
- requests.ts 的 `ImageGenBackground` 类型与 background 解析**保留不动**
  （源文档 P7：可保留类型定义，但不暴露给工具层）。

## 2. 施工清单

### A. P3 — 移除 response_format

1. provider.ts：删 :101-110 注释块 + `RESPONSE_FORMAT` 常量 + :154
   `form.append('response_format', …)` + :179 `response_format: …`。
   在文件头注或原位置补 T77 注记：**不显式指定 response_format——
   gpt-image 系端点拒绝该参数（400 `Unknown parameter: 'response_format'`），
   extractImageBytes 双格式消费使显式指定无收益**（据
   docs/202609010000-image-gen-provider-review.md P3）。
2. provider.test.ts：钉扎命名类型的 `response_format?` 字段 (:67) 删除；
   两处显式断言 (:100 / :143 区域) 改为**反向钉扎**：JSON body 无
   `response_format` 键（`'response_format' in body === false`）、multipart
   `form.get('response_format')` 为 null。相关注释同步。

### B. P7 — background 收归 provider 侧固定（owner 2026-09-02 决策）

3. generate.ts：GENERATE_IMAGE_PARAMETERS 删 background 字段 (:270-274)；
   :232-237 注释「九字段」改「八字段」。
4. provider.ts：:152 → `form.append('background', 'auto')`；
   :177 → `background: 'auto'`。注记：T77 P7——provider 侧固定 'auto'，
   Agent 无感（req.background 不再被读取）。
5. tool-contract.test.ts：VALID_REPLACE 删 `background: 'opaque'` (:30)；
   「九字段全集」表述改「八字段」；枚举错误拒绝例 (:59-74) 摘 background
   断言（transparent 场景已由 additionalProperties 覆盖——该值现在触发
   未知字段拒绝）。
6. provider.test.ts：:80 区域请求夹具仍传 `background: 'opaque'`（模拟
   遗留 JSON 串路径），断言线路上恒发 `'auto'`（:98 期望 'opaque' 改
   'auto' + P7 注记）——钉「provider 忽略 agent 侧 background」。
   :141 已期望 'auto'，不动。
7. requests.test.ts 不动（解析层保留 background 校验）。

### C. P6 — Seedream provider

8. provider.ts 抽出可复用核心：内部函数签名大致为
   `createProviderCore(options, wire: { name: string; background: 'auto' | 'opaque'; extraFields?: Record<string, unknown> })`，
   extraFields 对 FormData 走 `append(k, String(v))`、对 JSON 走对象展开
   （withCompression 同款双形态先例）。`createImageGenProvider` 改为
   core({ name: `openai-compatible(${model})`, background: 'auto' })。
9. 新文件 `provider-seedream.ts`：`createSeedreamImageGenProvider(options)`
   = core({ name: `seedream(${model})`, background: 'opaque',
   extraFields: { watermark: false } })（Seedream 默认带水印须显式关闭、
   不支持 'auto' 背景——据源文档 P6/P7 差异表）。头注写明端点协议族
   （/images/generations + /images/edits，同 OpenAI 形状）与三处差异。
10. 新文件 `factory.ts`：`createProviderFor(creds, options?)` 按
    `creds.providerType === 'seedream'` 分派两工厂（缺省 openai-compatible）。
    generate.ts :316-318 缺省工厂改调 `createProviderFor`（`deps.createProvider`
    注入点不动）。
11. provider-types.ts：注册表加第二条
    `{ id: 'seedream', label: 'Seedream-compatible (/api/v3/images)',
baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
modelPlaceholder: 'doubao-seedream-5-0-lite' }`；数组元素加可选
    placeholder 字段（用 `satisfies` + 显式 entry 接口，保持 `as const` 语义无
    需——interface ImageGenProviderTypeEntry { id, label, baseUrlPlaceholder?,
    modelPlaceholder? }，数组标 `readonly ImageGenProviderTypeEntry[]`，
    ImageGenProviderType 仍从数组 id 推导——注意类型推导改字面量联合可手写
    `'openai-compatible' | 'seedream'` 并加 type-level 一致性注释）。
12. ImageGenKeysSection.vue：baseUrl/model placeholder 改计算属性——
    当前选中 entry 的 `baseUrlPlaceholder ?? msgs.imageGenBaseUrlPlaceholder`
    （model 同理）。其余不动。

### D. 新测试 `tests/engine/rebuild/image-gen/provider-seedream.test.ts`

镜像 provider.test.ts 的 fetchImpl 注入夹具：

1. 文生图：POST `{baseUrl}/images/generations`、Bearer 头、body 含
   `watermark: false` + `background: 'opaque'` + `output_format` 缺省 'png'
   - **无 response_format 键**。
2. 图生图 multipart：`form.get('watermark')==='false'`、
   `background==='opaque'`、image[] 带文件名、无 response_format。
3. name === `seedream(${model})`。
4. req 传 `background: 'auto'` → 线路恒 'opaque'（固定覆盖钉扎）。
5. 注册表钉扎：`isImageGenProviderType('seedream')` true、两族 id 精确集。
6. `createProviderFor` 分派钉扎：seedream 凭证 → seedream provider（name
   断言）；openai-compatible → openai provider。

### E. 源文档回写（父仓 docs/，非 git 仓）

13. `docs/202609010000-image-gen-provider-review.md` §6 汇总表 P6/P7 行
    「⏳ 未实现」→「✅ 已实现（T77，2026-09-02）」；§5 结尾补一行实现注记
    （factory.ts 分派点 + provider-seedream.ts 落点）。P3 行已标 ✅ 不动。

## 3. 验收标准

1. `bun test tests/engine/rebuild/image-gen/` 全绿（含新文件 6 例）。
2. 门禁 unpiped：lint / tsgo / check:vue / format:check / zones / i18n / docs。
3. `grep -rn "response_format" src/` 零命中；`grep -n "background" generate.ts`
   schema 区零命中。
4. zones clean 且零新登记（所有触及文件在 ownedRoots/ownedFiles）。
5. 全量测试不本机跑（owner 2026-09-02 指示），CI 为准。

## 4. 边界

- 不动 requests.ts 的 ImageGenBackground 类型与解析（源文档明示保留）。
- 不动 credentials.ts / routes.ts / client.ts（注册表驱动，自动覆盖）。
- 不加 i18n 键（注册表 label 为专名英文串，沿 openai-compatible 先例；
  placeholder 走注册表回落 i18n）。
- description 1962 字符现状不动（无 background 行）。
- 红线沿用 T66 §4 不改清单：双段编排 / 0o600 / 超时 / 错误解析 / 响应解析。
