# T84 self-check——浏览器端 CJK 渲染收窄修复

## §1 plan 定谳逐项自评

### 定谳 1（范围）——PASS
- ✅ 只做「bundled 中文字体前插 CJK 回退链」。
- ❌ 未删任何 PuHuiTi 字重（`packages/core/assets/AlibabaPuHuiTi-*.ttf` 9 份齐全）。
- ❌ 未动 `BRIEF_FONT_FAMILY`（位于 src/app/**，本任务面外）。
- ❌ 未引入 Inter VF 化或 LXGW WenKai 下载。

### 定谳 2（前锋字体选型）——PASS
- ✅ 用已 bundled 的 Alibaba PuHuiTi Regular（`/AlibabaPuHuiTi-Regular.ttf` + assets 双份）。
- ✅ 零新字体资产：未下载/未新增任何 .ttf。

### 定谳 3（施工点，fonts.ts 两条路径都补）——PASS
1. ✅ `ensureCJKFallback`（原 :611-617）：`cjkFallbackPromise` 工厂内、在
   `ensureFallbackFamilies` 之前先调 `prependBundledCJK`。
2. ✅ `ensureFallbackPack` 带 characters 的直调路径（原 :646-650）：cjk 分支
   在 `ensureFallbackFamilies` 之前调同一 `prependBundledCJK`。
3. ✅ 远端 `CJK_GOOGLE_FONTS` 与本地系统字体段逻辑不变；helper 仅做
   「allowlist 启 + loadFont 命中 + 链中尚未存在」三连判定，命中即 `unshift`。
4. ✅ 顺序：bundled PuHuiTi → 本地 → 远端，local/remote 段相对序保持。
5. ✅ 幂等：helper 内 `targetFamilies.includes(family)` 守门；既有
   `length > 0` 快路径 + `cjkFallbackPromise` 去重保持。
6. ✅ 复用同一辅助函数，无双写逻辑。

### 定谳 4（测试钉扎）——PASS
新文件 `tests/engine/text/fonts/cjk-fallback.test.ts`（5 个用例）：
- ① bundled 命中时位于 CJK 回退链首位（`families[0] === 'Alibaba PuHuiTi'`，
  且注册链路上 `provider.registerFont('Alibaba PuHuiTi')` 命中）。
- ② bundled 加载失败时链行为降级到本地/远端（用 `loadFont` 截断 mock），不 throw。
- ③ 幂等（二次调用结果对象同一引用，`Alibaba PuHuiTi` 仅出现一次）。
- ④ `ensureFallbackPack` 直调路径（cjk + characters）也保证 bundled 最前。
- ⑤ bundled 锁定语义（T41 D-d）—`setFontFamilyEnabled` 拒关，前插不受影响。

mock 沿用 `allowlist.test.ts` 的 `recordingProvider` + `fastEmptyFetch` 模式。

## §2 偏差记录

无偏差。两处施工点和一处辅助函数均按 plan 落地，无代码漂移。

唯一调整：测试 ② 早期版本用 `globalThis.fetch = throw` 试图断网模拟失败，
但 `fetchBundledFont` 在 node 侧走 `fs/promises.readFile`（非 `fetch`），断网
不能阻断 bundled 读取。修正为对 `manager.loadFont('Alibaba PuHuiTi', 'Regular')`
做实例级 stub 返回 null，更直接也更稳定。修正后测试通过。

## §3 测试输出摘要

```
bun test tests/engine/text/fonts/
…
 164 pass
 0 fail
 1792 expect() calls
Ran 164 tests across 15 files. [1.56s]
```

新增的 5 个测试全部 pass；既有 159 个测试无回归。

## §4 文件变更清单（真实改动）

| 文件 | 改动 |
|------|------|
| `packages/core/src/text/fonts.ts` | `ensureCJKFallback` 工厂内插入 `prependBundledCJK` 调用；`ensureFallbackPack` cjk 直调分支同调；新增 `prependBundledCJK` 私有辅助函数（含 JSDoc） |
| `tests/engine/text/fonts/cjk-fallback.test.ts` | 新建，5 个用例钉扎定谳 4 |

总文件变更数：**1 改 + 1 增**（其他未触及）。

## §5 硬约束核对

- ✅ 未 `git add` / `git commit`。
- ✅ 未触碰 `src/app/ai/pi-backend/studio/**`、`active-design-host.ts`、
  `service.ts`、`tests/engine/rebuild/studio/**`（T85 工作面）。
- ✅ 未读 `.openpencil/key-env`。
- ✅ 未跑全量 `bun test`，仅 `tests/engine/text/fonts/`。
- ✅ 代码注释跟随周边风格（中文、简练、不写元注释）。
- ✅ `bunx oxfmt --write` 已仅对触及的 2 个文件执行。