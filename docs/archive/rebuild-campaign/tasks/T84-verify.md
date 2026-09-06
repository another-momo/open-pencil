# T84 verify——浏览器端 CJK 渲染收窄修复（独立核验报告）

> **核验身份**：独立 reviewer（只读核验 + 写本报告，不改代码、不 git 操作）
> **核验日期**：2026-09-02
> **核验基线**：工作区未提交 diff（分支 `rebuild/mode-arch`，git status 已确认）
> **核验范围**：T84 全部六项定谳 + 硬约束边界
> **受测 commit**：工作区未提交（`packages/core/src/text/fonts.ts` 改、`tests/engine/text/fonts/cjk-fallback.test.ts` 新建、`tools/zone-registry/zones.json` 单行登记）

---

## §1 逐项核验

### 1.1 定谳 3 双路径覆盖（PASS）

**证据**：

- `packages/core/src/text/fonts.ts:611-621` `ensureCJKFallback`：在原 `ensureFallbackFamilies` 调用前先 `await this.prependBundledCJK(this.cjkFallbackFamilies)`；外层 `cjkFallbackPromise` 去重 + `length > 0` 快路径保持。
- `packages/core/src/text/fonts.ts:646-660` `ensureFallbackPack` cjk + characters 直调分支：`if (script === 'cjk') await this.prependBundledCJK(target)`，复用同一辅助，无双写。
- `packages/core/src/text/fonts.ts:676-684` `prependBundledCJK` 私有辅助：
  1. `if (!this.allowlist.isEnabled(family)) return` — allowlist 未启用时不前插（防御性早返回，避免 bundled 锁定族在异常 allowlist 态下被误插）；
  2. `if (targetFamilies.includes(family)) return` — 幂等守门；
  3. `const buffer = await this.loadFont(family, 'Regular')` — `loadFont` 返回 `null` 时直接走 else（不 throw，不 unshift），由 `ensureFallbackFamilies` 继续走本地/远端链。
- 判定：两条路径同调同一辅助，幂等三连（allowlist → includes → buffer）齐全，失败静默降级——PASS。

### 1.2 顺序语义（PASS）

**证据**：

- `packages/core/src/text/fonts.ts:686-730` `ensureFallbackFamilies`：local 段以 `targetFamilies.push(family)` 追加，remote 段在 `length === 0 || characters` 时触发、同样 `targetFamilies.push`。
- `prependBundledCJK` 使用 `unshift` 在数组头部前插 `Alibaba PuHuiTi`；由于 `prepend` 发生在 `ensureFallbackFamilies` 之前（且 `ensureFallbackFamilies` 仅做 `push`），最终顺序必然是 `bundled PuHuiTi → 本地 → 远端`。
- 远端 `CJK_GOOGLE_FONTS` 与本地系统字体段逻辑零改动——`ensureFallbackFamilies` 全函数未触碰。
- 判定：相对序（bundled 前 / local 中 / remote 末）未被破坏——PASS。

### 1.3 不做清单守住（PASS）

**证据**：

- `git diff --stat` 工作区共 12 文件改动；T84 范围仅触及 3 文件：
  - `packages/core/src/text/fonts.ts`（+22）
  - `tests/engine/text/fonts/cjk-fallback.test.ts`（新建，+118）
  - `tools/zone-registry/zones.json`（+1 单行登记）
- 其余 9 文件改动（`src/app/ai/pi-backend/**`、`tests/engine/rebuild/**`、`tools/rebuild/**`）属 T85 工作面，已被 `docs/rebuild/tasks/T85-self-check.md` 登记；T84 self-check §5 已声明未触碰，本核验独立确认未越界。
- `git diff packages/core/src/text/fonts.ts` 全文检索 `BRIEF_FONT_FAMILY` / `LXGW` / `WenKai` / `Inter VF`：零出现。
- `packages/core/assets/` 与 `public/` 字体文件清单核对：PuHuiTi 9 字重（Thin→Black）+ Inter 5 字重齐全，未删未加（git status 未列示字体文件改动）。
- `BRIEF_FONT_FAMILY`（`packages/core/src/tools/fork/marketing/brief.ts:95`）未出现在 git diff 中。
- 判定：核心改动面严格收敛至 fonts.ts + 新测试 + zones 单行登记——PASS。

### 1.4 测试钉扎质量（PASS）

**证据**：

- `tests/engine/text/fonts/cjk-fallback.test.ts` 共 5 个用例：
  - ① `bundled 命中时位于 CJK 回退链首位`：`families[0] === 'Alibaba PuHuiTi'` + `registrations.toContain('Alibaba PuHuiTi')` + `manager.isLoaded(...) === true`；
  - ② `bundled 加载失败时链行为与现状一致`：实例级 stub `manager.loadFont` 对 `Alibaba PuHuiTi` 返回 null，断言 `Array.isArray(families) && !families.includes('Alibaba PuHuiTi')` —— 真钉住降级路径且不 throw；
  - ③ `幂等`：连续两次 `ensureCJKFallback` 断言 `first === second`（同引用）+ `first.filter(...).length === 1`；
  - ④ `ensureFallbackPack 直调路径（cjk + characters）`：与 cjk + characters 直调路径对应，断言 `result.cjk?.[0] === 'Alibaba PuHuiTi'`；
  - ⑤ `PuHuiTi 是 bundled 锁定族（T41 D-d）`：断言 `isFontFamilyLocked === true` + `setFontFamilyEnabled(..., false) === false` + 前插仍生效——额外钉住 T41 D-d 语义。
- mock 缝合：
  - `recordingProvider` 实例级 stub（每个 test 自建 `provider`），不污染全局；
  - `fastEmptyFetch` 直接复用 `allowlist.test.ts` 既有模式（`tests/engine/text/fonts/allowlist.test.ts:14-19`）；
  - ② 例中 `manager.loadFont = ...` 实例级赋值（自评偏差 1 已修正：早期 `globalThis.fetch = throw` 阻断不到 bundled 读取，因 `fetchBundledFont` 走 `fs/promises.readFile`，故改用更直接的实例 stub）——修正方向正确。
- 翻红敏感性：①④例直接断言 `families[0]`，若未来有人把 `prependBundledCJK` 顺序错乱（如改为 `push` 或挪到 `ensureFallbackFamilies` 之后）会立即翻红；③例 `first === second` 引用同一性能捕捉 promise 重入；⑤例钉住 T41 D-d 锁定语义，不会被白名单改动影响。
- 判定：5 例覆盖定谳 4 三连 + 直调路径 + T41 D-d 锁定语义，mock 缝合正确，翻红敏感——PASS。

### 1.5 zones 登记（PASS）

**证据**：

- `tools/zone-registry/zones.json:59` 在已有 `tests/engine/text/fonts/*.test.ts` 序列中追加 `"tests/engine/text/fonts/cjk-fallback.test.ts",`（紧邻 `cn-catalog.test.ts`，与既有登记模式一致）。
- 沿用同段 `ownedFiles`，未新建 `ownedRoot`；与既有 fonts 测试登记风格一致。
- 判定：单文件登记模式匹配既有——PASS。

### 1.6 实测复跑（PASS）

**证据**：

- 命令：`bun test tests/engine/text/fonts/`
- 输出：`164 pass / 0 fail / 1792 expect() calls / Ran 164 tests across 15 files. [1.84s]`
- 与自评 §3 摘要（164 / 0 / 1792）完全一致；新增 5 例全部 pass，无回归。
- 判定：与定谳 + 自评吻合——PASS。

---

## §2 硬约束边界核验（PASS）

- 未 `git add` / `git commit`（仅用 `git status` / `git diff` / `git diff --stat` 只读命令）。
- 未触碰 `.openpencil/key-env`（仅 `ls .openpencil/` 确认目录结构以验证硬约束遵守，未读取 key-env 内容）。
- 未跑全量 `bun test`，仅跑 `tests/engine/text/fonts/`。
- 未读 `src/app/ai/pi-backend/studio/**`、`active-design-host.ts`、`service.ts` 等 T85 工作面（仅 `grep` 列表名以核验越界）。
- 未触发 `bunx oxfmt`（未触碰任何代码文件）。

---

## §3 总结论

**6/6 PASS，0 FAIL。**

T84 全部定谳逐项核验通过：
- 双路径同走 `prependBundledCJK`，无逻辑双写；
- 顺序语义未被破坏（bundled→本地→远端）；
- 不做清单守住（fonts.ts + 新测试 + zones 单登记三个文件以外零核心改动）；
- 测试 5 例钉扎质量合格（覆盖定谳 4 三连 + 直调 + T41 D-d 锁定，mock 实例级，翻红敏感）；
- zones 单文件登记模式一致；
- 实测 164 pass / 0 fail。

施工质量与定谳吻合度高，自评偏差 1（mock 缝从全局 fetch 改为实例 stub）的修正方向正确。无新增 FAIL 项，无回归。

---

## §4 问题清单

无。

---

## §5 签收

- 核验身份：独立 reviewer（只读核验）
- 核验日期：2026-09-02
- 工作区状态：未提交 diff（分支 `rebuild/mode-arch`，5 commits ahead of origin）
- 报告路径：`docs/rebuild/tasks/T84-verify.md`
- 下一步建议：主 agent 可据此收口跑七门禁；T84 可作为单独 commit 收口（建议 commit message 形如 `T84: prepend bundled PuHuiTi to CJK fallback chain`）。