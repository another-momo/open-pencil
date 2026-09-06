# T77 自检 · image-gen provider 收尾批（P3 response_format 移除 + P7 background 收归 + P6 Seedream）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T77-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T77-plan §2/§3 逐项核验。

## 1. 验收逐项（T77-plan §3）

### 1.1 `bun test tests/engine/rebuild/image-gen/` 全绿

✅ 104 pass / 0 fail / 318 expect()，12 文件（含新文件
provider-seedream.test.ts 10 例）。fast-worker 交付后跑一次、主 agent
修门禁后再跑一次，两轮同数全绿。

### 1.2 门禁 unpiped

✅ 2026-09-02 主 agent 复跑全绿：

- `bun run lint` → 0 errors
- `bun run tsgo` → clean
- `bun run check:vue` → clean（修复后，见 §3 偏差 4）
- `bun run format:check` → 2171 files 全过
- `bun run check:zones` → clean，**零 P-NN 登记**（触及文件全部位于
  ownedRoots pi-backend/ + tests/engine/rebuild/ 与 ownedFiles
  ImageGenKeysSection.vue，与 plan §1 zones 预判一致）
- `bun run check:i18n` → in sync（未加键，沿 plan §4 边界）
- `bun run check:docs` → 44/44

### 1.3 grep 证据

- `grep -rn "response_format" src/` → 仅命中 provider.ts:10-11 两行
  T77 P3 头注（文档性提及），**代码面零发送点**：RESPONSE_FORMAT 常量、
  `form.append('response_format', …)`、JSON body `response_format:` 键
  全部移除。
- `grep -n "background" generate.ts` → 3 处命中全部为注释/散文
  （:20 头注、:64 description 中 "frame background" 文案、:239 注释），
  **schema 区（:238-300）零命中**——background 字段已删，八字段。
- provider.ts 实证：`form.append('background', wire.background)` (:191)
  与 `background: wire.background` (:215)——req.background 不再被读取；
  openai 族 wire 'auto'（:244）、seedream 族 wire 'opaque'
  （provider-seedream.ts:30）。

### 1.4 zones clean 且零新登记

✅ 见 §1.2。

### 1.5 全量测试不本机跑

✅ 本机仅跑 image-gen 单目录（直接相关）；全量交 CI。

## 2. 施工清单逐项（T77-plan §2）

### A. P3 — response_format 移除

1. ✅ provider.ts：常量 + 两处发送点 + 旧 T66 P3 注释块全删；头注补
   T77 P3 注记（gpt-image 系 400 拒绝 + extractImageBytes 双格式消费
   使显式指定无收益，:10-12）。
2. ✅ provider.test.ts：钉扎类型 `response_format?` 字段删除；两断言改
   反向钉扎（`'response_format' in body === false` /
   `form.get('response_format')` 为 null），注记同步。

### B. P7 — background 收归 provider 侧

3. ✅ generate.ts：schema 删 background 字段；注释九字段→八字段
   （:232-237）；头注补 T77 P7 段（:20-23，明示 requests.ts 类型层保留）。
4. ✅ provider.ts：两处发送点改 `wire.background`（薄封装层固定值）；
   wire 注释写明 req.background 不再读取（:118-119）。
5. ✅ tool-contract.test.ts：VALID_REPLACE 删 background；「八字段全集」；
   枚举测试改 quality/output_format 两项 + 注记说明 background 现由
   additionalProperties 拒绝（transparent 断言保留为未知字段拒绝例）。
6. ✅ provider.test.ts：文生图夹具仍传 `background: 'opaque'`，断言线路
   恒 `'auto'` + P7 注记（钉 provider 忽略 agent 侧 background）。
7. ✅ requests.test.ts 未动（git status 无此文件）。

### C. P6 — Seedream provider

8. ✅ provider.ts 抽出 `createProviderCore(options, wire)`；wire 形状
   `{ name, background, extraFields? }` 与 plan 一致；extraFields 双形态
   （FormData `append(k, String(v))` / JSON 对象展开，:171-176，
   withCompression 同款先例）。薄封装 `createImageGenProvider` =
   core({ name: openai-compatible(model), background: 'auto' })。
9. ✅ provider-seedream.ts 新文件：`createSeedreamImageGenProvider` =
   core({ name: seedream(model), background: 'opaque', extraFields:
   { watermark: false } })；头注含三族差异表（watermark/background/
   response_format）。
10. ✅ factory.ts 新文件：`createProviderFor(credentials, options = {})`
    按 `providerType === 'seedream'` 分派，options 透传 fetchImpl/timeoutMs；
    generate.ts 缺省工厂改调 `createProviderFor`，`deps.createProvider`
    注入点不动。
11. ✅ provider-types.ts：`ImageGenProviderTypeEntry` 接口（id/label/两个
    可选 placeholder）；注册表加 seedream 条目（label
    'Seedream-compatible (/api/v3/images)'，baseUrlPlaceholder
    ark.cn-beijing.volces.com/api/v3，modelPlaceholder
    doubao-seedream-5-0-lite）；`ImageGenProviderType` 改手写字面量联合
    - 注释说明靠 provider-seedream.test.ts 注册表钉扎兜底。
12. ✅ ImageGenKeysSection.vue：`selectedProviderEntry` /
    `baseURLPlaceholder` / `modelPlaceholder` 三个 computed，缺省回退
    i18n；模板 :133/:143 改绑 computed。其余不动。

### D. provider-seedream.test.ts（10 例）

✅ 覆盖 plan 六项全部：文生图 body 钉（watermark:false + background
'opaque' + 无 response_format）、multipart 钉（watermark 'false' 字符串、
image[] 文件名、无 response_format）、name 形状、req.background 'auto'
被覆盖为 'opaque'、注册表钉扎（两族精确集 + isImageGenProviderType）、
createProviderFor 双向分派钉扎。

### E. 源文档回写（父仓 docs/，非 git 仓）

13. ✅ `docs/202609010000-image-gen-provider-review.md` §6 汇总表 P6/P7
    行改「✅ 已实现（T77，2026-09-02）」；§5 结尾补实现注记（factory.ts
    分派点 + provider-seedream.ts 落点）。

## 3. 偏差（相对 plan，均已在案）

1. **createProviderCore 导出而非内部函数**（plan §2.8「内部函数签名大致为」）：
   provider-seedream.ts 是同目录兄弟模块，非导出无法复用；已加注释明示
   「不写入对外 API 面」。实质语义与 plan 一致（非公共出口）。
2. **credentials.test.ts 触及超出 plan 清单**：该文件注册表钉扎断言
   `isImageGenProviderType('seedream') === false` 在 C 项落地后必然变假，
   不更新则测试必红——属 plan C11 的必然连带，更新为两族精确集钉扎。
3. **provider-seedream.test.ts 10 例 vs plan 6 项**：worker 将复合钉扎拆为
   独立用例（注册表两族/分派双向各拆），覆盖面不减、可读性更好；plan §3.1
   「含新文件 6 例」按实质覆盖解释（六项语义全在）。
4. **主 agent 交付后修门禁 3 处**（fast-worker 未过门禁即交付）：
   check:vue TS2339 ×2（script computed 中 `msgs.xxx` 需 `msgs.value.xxx`，
   useForkImageGen 返回 Readonly<Ref> 模板外不自动解包）；lint
   no-template-curly-in-string ×1（测试名含反引号模板字面量 → 改
   「name 为 seedream（<model>）形状」）。修复后 §1.2 全绿。
5. T66 P3 旧注释块删除时其一并移除的「风险在案」段落（按 providerType
   分派的预案）已过时——本任务的 factory.ts 即该预案的落地形态，头注
   新注记已含等价信息。
6. **CI 反向发现：test:type-shapes duplicate CapturedCall**（fast-worker
   - 主 agent 本地七门禁均未捕获——`bun run test:type-shapes` 不在
     七门禁 unpiped 清单内，属 Code quality job 第 8 步「Enforce
     architecture and type-shape boundaries」独占）。原因：
     provider-seedream.test.ts 的 mockFetch + CapturedCall 与
     provider.test.ts 字面完全一致。
     修复（v1）：抽共享夹具到 `tests/engine/rebuild/image-gen/_mock-fetch.ts`，
     两测试改 import；修复后 `bun run test:type-shapes` →
     「No duplicate object type shapes found」、image-gen 套件仍
     104 pass/0 fail/318 expect/12 文件。
     修复（v2）：run 33606578193 又红——check:arch 规则
     `strict-test-file-placement`：tests/engine/\*_ 下只允许 _.test.ts /
     helpers.ts / \*.bench.ts / domain 视觉脚本，`_mock-fetch.ts` 不在
     白名单。`git mv` → `helpers.ts`（白名单内）；两测试 import 改
     `./helpers`；修复后 `bun run check:arch` → ✔ No problems found、
     type-shapes 仍 clean、image-gen 套件仍 104/0/318/12。
7. **CI 反向发现：check:tasks 读 HEAD message 而非 staged message**——
   主 agent 收口时因 a4c380e29（T75 编号修正 commit）HEAD 不含
   `task:` 指针触发大改动无指针违规。修复：amend 该 HEAD 为
   `task: T75-plan 编号指针修正……`（语义正确——该 commit 修正的是
   T75-plan 编号），T77 commit（549754dea）随后自然通过 check:tasks。
   此为 check:tasks 已知设计（`getCommitMessage` 读 `git log -1
--format=%B`）的链式后果——若 owner 想根治，可让该 hook 读 staged
   message 或允许 owner-tag 豁免。

## 4. 边界守护（T77-plan §4）

- requests.ts 未动（ImageGenBackground 类型与解析保留，git status 无此文件）。
- credentials.ts / routes.ts / client.ts 未动。
- 未加 i18n 键。
- GENERATE_IMAGE_DESCRIPTION 未动（1962 字符，本无 background 行）；
  tool-contract description 钉扎测试仍绿。
- T66 红线清单（双段编排 / 0o600 / 超时 / 错误解析 / 响应解析）未触碰：
  provider.ts diff 仅及头注、wire 化、extraFields、P3 删除四处。
