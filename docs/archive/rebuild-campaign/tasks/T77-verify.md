# T77 核验 · image-gen provider 收尾批（P3 + P7 + P6）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。
> 对象 = worktree `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil-mode`
> （branch rebuild/mode-arch）+ 父仓源文档。对照 T77-plan §2/§3 与
> T77-self-check 逐项取证，全部核验均重新取证，不采信自检结论。

## 结论：PASS 12/12

## 逐项核验

1. **变更集与 T77 范围一致 — PASS**
   `git status --short` 实得：7 个修改文件（generate.ts、provider-types.ts、
   provider.ts、ImageGenKeysSection.vue、credentials.test.ts、provider.test.ts、
   tool-contract.test.ts）+ 3 个新源码/测试文件（factory.ts、provider-seedream.ts、
   provider-seedream.test.ts）+ 2 个 T77 文档（T77-plan.md、T77-self-check.md）。
   与任务范围精确吻合，无任何意外文件；requests.ts 不在变更集中。

2. **grep 证据 — PASS**
   - `grep -rn "response_format" src/` 仅 2 行命中，均为 provider.ts:10-11 的
     T77 P3 头注（文档性提及），代码面零发送点。
   - `grep -n "background" generate.ts` 命中 3 处全为注释/散文（:20 头注、
     :64 description 文案、:239 注释）；schema 区（GENERATE_IMAGE_PARAMETERS，
     generate.ts:244-301）零命中。
   - `packages/core/src/tools/fork/image-gen/requests.ts` 不在 git status 中
     （未触碰），且仍定义 `ImageGenBackground`（:21 类型、:48 字段、
     :221 枚举值表）。

3. **provider.ts 全文核验 — PASS**
   - 无 `RESPONSE_FORMAT` 常量（grep 零命中），无 `form.append('response_format')`、
     无 JSON body `response_format` 键。
   - `createProviderCore(options, wire)` 导出（:138），wire 形状
     `{ name: string; background: 'auto' | 'opaque'; extraFields?: Record<string, unknown> }`
     （ProviderCoreWire，:127-131）。
   - `applyExtraFields` 双形态：FormData `append(k, String(v))`（:174）/
     JSON 对象展开 `target[k] = v`（:175），与 withCompression（:159-168）同款先例。
   - background 恒发 wire 值：multipart `form.append('background', wire.background)`
     （:191）、JSON `background: wire.background`（:215）；`req.background` 全文
     仅出现在注释（:13、:119），代码不读取。
   - 薄封装 `createImageGenProvider` = core({ name: `openai-compatible(${model})`,
     background: 'auto' })（:240-246）。
   - T66 红线面（超时 :179、apiErrorMessage :82-105、extractImageBytes :59-73）
     结构与既往一致。

4. **factory.ts 与 provider-seedream.ts 核验 — PASS**
   - factory.ts `createProviderFor(credentials, options = {})` 按
     `credentials.providerType === 'seedream'` 分派至 createSeedreamImageGenProvider，
     缺省落 createImageGenProvider（:19-27）；options（fetchImpl/timeoutMs）透传；
     头注明示未知 providerType 兜底 openai-compatible 的设计理由。
   - provider-seedream.ts = core({ name: `seedream(${model})`, background: 'opaque',
     extraFields: { watermark: false } })（:27-33）；头注含与 OpenAI 族的差异表
     （watermark/background/output_format）与端点协议族同形说明。

5. **generate.ts schema 区核验 — PASS**
   GENERATE_IMAGE_PARAMETERS（:244-301）恰为八字段：prompt、width、height、
   quality、output_format、output_compression、replace_id、references，无
   background；:238-239 注释已写「八字段……T77 P7 删 background，由 provider 侧
   固定」。缺省工厂 :317-318 改调 `createProviderFor(creds)`；`deps.createProvider`
   注入点保留（`deps.createProvider ??`）。

6. **provider-types.ts 核验 — PASS**
   `ImageGenProviderTypeEntry` 接口（:23-30，id/label + 可选 baseUrlPlaceholder/
   modelPlaceholder）；注册表两条目，seedream 条目（:37-42）label
   `'Seedream-compatible (/api/v3/images)'`、baseUrlPlaceholder
   `'https://ark.cn-beijing.volces.com/api/v3'`、modelPlaceholder
   `'doubao-seedream-5-0-lite'`；`ImageGenProviderType` 为手写字面量联合
   `'openai-compatible' | 'seedream'`（:50）+ 一致性兜底注释（:45-49）；
   `isImageGenProviderType` 注册表驱动（:54-56）。

7. **ImageGenKeysSection.vue 核验 — PASS**
   三个 computed：selectedProviderEntry（:43-45）、baseURLPlaceholder（:46-48）、
   modelPlaceholder（:49-51），缺省回退 i18n 且正确使用 `msgs.value.` Ref 解包
   （:47、:50）；模板 :133 `:placeholder="baseURLPlaceholder"`、:143
   `:placeholder="modelPlaceholder"` 绑定 computed。其余逻辑（save/clear/watch）
   未动。

8. **provider-seedream.test.ts 全文核验 — PASS**
   10 例覆盖任务要求全部六项：文生图 JSON 钉（watermark:false + background:
   'opaque' + output_format 缺省 'png' + `'response_format' in body === false`，
   :82-121）；multipart 钉（watermark 'false' 字符串 :145、background 'opaque'
   :143、image[] 文件名 input-1.png/input-2.png :148-152、`form.get('response_format')`
   为 null :147）；name 形状 `seedream(doubao-seedream-5-0-lite)`（:158-161）；
   req.background:'auto' 被固定覆盖为 'opaque'（:163-177）；注册表钉扎
   （isImageGenProviderType 双向 :181-185、两族精确集 :187-190、占位字段
   :192-196）；createProviderFor 双向分派 + options 透传（:199-221）。

9. **`bun test tests/engine/rebuild/image-gen/`（unpiped）— PASS**
   实跑：`104 pass / 0 fail / 318 expect() calls，Ran 104 tests across 12 files
[2.43s]`，exit 0。与自检声称（104/12/318，新文件 10 例）完全一致。

10. **门禁七项（全部 unpiped，exit 均 0）— PASS**
    - `bun run lint` → 0 errors（9+7 条 max-lines warnings 均为存量文件，与
      T77 无关）
    - `bun run tsgo` → clean（无输出，exit 0）
    - `bun run check:vue` → clean（两段 vue-tsc 均无报错，exit 0）
    - `bun run format:check` → `All matched files use the correct format`，
      2171 files
    - `bun run check:zones` → `[zones] clean: 85 modified (all registered),
561 added (owned), 1019 deleted (all registered), 0 renamed`，零未登记
    - `bun run check:i18n` → `All locale files are in sync.`
    - `bun run check:docs` → `check-docs: 44/44 通过`

11. **父仓源文档回写核验 — PASS**
    `docs\202609010000-image-gen-provider-review.md`：§6 汇总表 P6 行（:488）
    与 P7 行（:489）均为「✅ 已实现（T77，2026-09-02）」；另一状态表（:500-501）
    同步标「✅ 已完成（T77，2026-09-02）」。§5 结尾实现注记（:470-473）明示
    `provider-seedream.ts`（wire.background 'opaque' + extraFields watermark:
    false）与 `factory.ts` createProviderFor 分派点、注册表 seedream 条目与
    手写联合兜底。P3 行原已标 ✅ 未动。

12. **自检 §3 偏差列表复核 — PASS**
    - 偏差 1（createProviderCore 导出而非内部函数）：属实。provider.ts:133-137
      注释明示「内部暴露给 provider-seedream.ts 共用——不写入对外 API 面
      （不在 factory.ts 重导出）」；:124-125 的「不导出」指向 ProviderCoreWire
      接口（该接口确实未导出），与函数导出无矛盾。
    - 偏差 2（credentials.test.ts 触及超 plan 清单）：属实且为必然连带。该文件
      :39-46 现为「T77 P6 注册表含 openai-compatible + seedream 两族」精确集
      钉扎；不更新则旧断言必红。
    - 偏差 3（seedream 测试 10 例 vs plan 6 项）：属实。实跑 10 例全绿
      （请求形状 4 + 注册表 3 + 分派 3），plan 六项语义全覆盖（见核验 8）。
    - 偏差 4（主 agent 修门禁 3 处）：属实。check:vue 现全绿（核验 10）；
      测试名 :158 为「name 为 seedream(<model>) 形状」，无反引号模板字面量，
      lint 零 no-template-curly-in-string 报错。
    - 偏差 5（T66 旧预案注释段移除）：属实。provider.ts 头注 T77 段（:9-17）
      已含 factory.ts 分派的等价信息。

## 偏差复核

自检 §3 全部 5 项偏差均与实况相符（见核验 12），无隐瞒偏差；自检声称的
测试数、门禁结果、grep 证据均经独立复跑/复读确认一致。

## 发现的问题

无。
