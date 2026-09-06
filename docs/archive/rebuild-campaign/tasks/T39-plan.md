<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T39 计划 · 字体能力建设（注册表白名单 + PuHuiTi 子集内置 + 加载链修复）

> **状态**：已完成（C1-C6 全过，见 [T39-verify](T39-verify.md)） | **时间**：2026-08-29 立项 / 2026-08-30 收口 | **负责人**：主 agent
> **分支**：`rebuild/fonts`（pi 线，基于 `08e43132` T38 收口后 HEAD）
> **规格真源**：预研 [13-font-subset-loading-proposal](../../../../docs/202608251637-migration-proposal/13-font-subset-loading-proposal.md)（S2 蓝图）、[14-variable-font-weight-review](../../../../docs/202608251637-migration-proposal/14-variable-font-weight-review.md)（O3 决策本体）、[15 册 D.5](../../../../docs/202608251637-migration-proposal/15-agentB-workflow-runtime-archive.md)（字体治理两层分离）、[05 册 T1](../../../../docs/202608251637-migration-proposal/05-upstream-render-fonts.md)（CJK 字体链修复清单）

## 1. 背景与立项

owner 拍板（2026-08-29）：**字体问题先解决，否则影响后期验证**。依据预研结论：

- 13 册头注实测：字体栈是营销工具移植测试的**硬前置**——`tests/engine/text/fonts/{loading-keys,multi-provider}.test.ts`、sample-color CanvasKit 解码、raster JPG 白底断言、brief 工具对 Alibaba PuHuiTi 的全量 TEXT 断言，全部踩在字体栈行为之上；
- rebuild 现状字体栈**真空**（13 册实测，`ls packages/core/src/assets` 仅 Inter×5+NotoNaskhArabic；无 PuHuiTi/fallback-break/systemFontDataCache/font-subset 工具）；S2 规格 §7 要求的注册表白名单不存在；
- 加载路线已拍板 S3（rebuild tracker 决策批 2026-08-28）：桌面 = bundled 子集兜底，Web = CDN 按需子集。本任务落地 S3 的**公共前置**（注册表 + 授权 tier 登记 + bundled 子集管线），CDN provider 留接缝。

**fork 现成资产**（旧 worktree `../open-pencil` 在仓可直取，2026-08-29 `ls` 实测）：
- `packages/core/assets/fonts/`：AlibabaPuHuiTi 9 字重 ttf（Thin→Heavy）+ Inter×5 + NotoNaskhArabic；
- `tools/font-subset/`：`subset-fonts.py` + `charset-cjk.txt`（64MB→20MB 子集化管线，12 册定谳 #6 实测在仓）。

## 2. 决策点（本任务开工前拍板/默认项登记）

| # | 决策点 | 状态 | 取值 |
|---|---|---|---|
| D-a | 加载路线 S3 | ✅ 已拍板（tracker 决策批 2026-08-28） | 桌面 bundled 子集 + Web CDN 子集 |
| D-b | O3 本地字体字重匹配（14 册 §2.2） | ⬜ **待 owner 拍板** | 候选：①恢复严格契约（显式 style 不得就近降级）②放宽匹配（删 `if(style) continue`，同斜体任意字重兜底）。**行为变更，未拍板前本任务不动 `chooseLocalFontMatch` 语义** |
| D-c | 字重切换时序竞争（14 册 §2.1 现象 B） | ✅ 采纳方案 B | pending 态也吃 textPicture 缓存——选字重后文字保持旧渲染直至新字重就绪，不再「消失-闪现」 |
| D-d | 白名单拦截点范围（15 册 D.5） | ✅ 采纳结构性拦截 | 三拦截点：`listFamilyOptions`（picker 枚举）/ `ensureGraphFonts` 渲染引用 / `loadFont` 加载入口。非白名单家族：枚举不可见、渲染引用告警降级、加载拒绝（营销策略资产合法性由 S2 profile 校验消费） |
| D-e | 字体二进制入仓形态（勘查新增） | ✅ 默认普通 git，LFS 化推延 | 普通 git 对象本地提交（~20MB）；LFS 化+自有托管 push 待网络/托管策略定（zones.json:170 已预警）。翻案点：若 CI/远端验证必须先 push，再议 |

## 3. 范围与修法

### S1 字体注册表 + 白名单（core 新建）

- `packages/core/src/text/font-registry.ts`（新建）：注册表条目 `{ family, tier: 'T0'|'T1'|'T2', license, source, weights[] }`；常量内置 Inter / Alibaba PuHuiTi / Noto Naskh Arabic 三套 + tier 元数据（PuHuiTi=T1「厂商保留收回权利」标注，15 册 D.5）。
- 三拦截点接入：`fontManager.listFamilyOptions()` 过滤、`ensureGraphFonts` 渲染引用检查（非白名单→告警+走 fallback 链）、`loadFont` 入口拒绝。系统字体（Tauri 枚举）不受白名单限（用户本地资产，白名单只管「应用提供/推荐」面——对齐 15 册「结构性约束而非 prompt 约束」的意图边界）。
- **不做**：字体生命周期治理 UI、准入审批流（治理层是流程不是代码，15 册 D.5 两层分离）。

### S2 PuHuiTi 子集内置（S3 路线的桌面兜底半）

- 迁移 `tools/font-subset/`（subset-fonts.py + charset-cjk.txt）到本仓 `tools/`（管线存档，可复跑）；PuHuiTi 9 字重**子集产物**（每字重 ~2.2MB，9 个共 ~20MB，2026-08-29 `du` 实测）从旧 worktree 工作树直取（`../open-pencil/packages/core/assets/AlibabaPuHuiTi-*.ttf` 实测为真 TTF 非指针），进 `packages/core/assets/fonts/`。
- `BUNDLED_FONTS` 注册 9 字重（`fonts.ts:32` 表现存 6 条 Inter/Noto 映射）；加载链不变（bundled URL 直取）。
- **⚠️ LFS 断点（2026-08-29 勘查实测）**：旧分支这些 ttf 走 LFS（其 `.gitattributes:4-5` 两条规则），git 内为指针；本仓 zones.json:170 登记「fork 自有 GitHub LFS 预算已超、.lfsconfig 保持指向上游网关、新增 LFS 文件 push 需自有托管」——叠加当前 GitHub 直连不通（2026-08-29 push 失败实测）。**处置：本地提交走普通 git 对象（不加 LFS 规则，仓库 +~20MB）；LFS 化与 push 托管推延为 D-e 决策（见 §2），不阻塞本地建设与验证。**
- **验收锚**：brief 工具的「全量 TEXT 用 Alibaba PuHuiTi」断言可在本仓跑通（01 册测试清单 #1）。

### S3 加载链修复（05 册 T1 + 14 册，与 AI 无关的通用 bug）

- `systemFontDataCache` 泄漏修复：`src/app/editor/fonts/index.ts` 的 `loadSystemFont` 每次 invoke 无缓存 → 补缓存（fork 05 册 T1 同款）。
- 时序竞争（D-c）：pending 态 textPicture 缓存策略调整——`canvas/text/index.ts` 的 `requiredFacesReadiness()` 返 `'pending'` 时保留旧 picture 而非立即可不见【实施时核对现状代码行】。
- **不做**：`chooseLocalFontMatch` 语义（挂 D-b）；isVariableFont 双门行为维持现状（14 册：loading-keys 测试用例走向随 D-b/O3 再定）。

### S4 CDN 子集 provider 留接缝（S3 路线的 Web 半）

- `fontManager.setWebFontFetch`/provider 机制在仓（`editor/fonts/index.ts` 已见）；cn-font CDN provider（13 册 §4.2：jsdelivr `@chinese-fonts/*` 子集 woff2，CORS 已验证可跨域）**只立接口与 spike 结论，不做完整实现**——Web 端多字体是 Phase 3 之后的增强，本任务以桌面兜底闭环为验收边界。

## 4. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | 注册表+白名单三拦截点生效：非白名单家族 picker 不可见/渲染降级告警/加载拒绝；系统字体不受影响（实测+单测） | ✅（registry.test.ts 6/6 + 浏览器实证选择器仅列 3 注册表家族） |
| C2 | PuHuiTi 9 字重子集产物入仓（LFS），`BUNDLED_FONTS` 注册，文档新建 TEXT 指定 PuHuiTi 渲染出中文（浏览器实证截图） | ✅（入仓形态按 D-e 翻案为普通 git 对象；截图 t39-c2-*.png：选择器/Regular 28px 中文/Bold 切换无闪现） |
| C3 | `loadSystemFont` 缓存生效（重复调用单次 invoke，单测断言）；时序竞争修复（选未加载字重文字不再消失，单测或浏览器实证） | ✅（P109 会话缓存代码落实；P108 由 P112 两单测钉住 + Bold 切换浏览器实证） |
| C4 | `test:unit` 绿 + 新增字体测试绿；`smoke:pi` 80/80 不回退 | ✅（字体 83/83 + 渲染文本新增 2 例过；smoke:pi 80/80；test:unit:quick 99 fail 经基线对照为既有环境/上游债，见 verify §V5） |
| C5 | `check` 门禁全绿（含 check:zones——新文件落 owned 区登记；format:check / lint / tsgo / vue-tsc） | ✅（tsgo/lint 0 error/format:check/check:zones 60 modified 全登记；实测表见 self-check §2） |
| C6 | 三件套齐 + tracker/_index T39 行 + 翻案登记（若 D-b 施工期拍板） | ✅（plan/self-check/verify 齐 + tracker/_index 登记；D-b 未拍板未动，D-e LFS 翻案已登记） |

## 5. 出栈（明确不做）

- O3 字重匹配语义（挂 D-b 待拍板）；
- isVariableFont 双门调整（随 D-b）；
- CDN 子集 provider 完整实现（S4 只留接缝）；
- 思源黑体/宋体等 T0 字体扩充（S2 规格 §7 候选，随 profile 精品集定稿一并进——字体扩充与 D6 子集化绑定工作包）；
- CanvasKit 断行禁则实测（S4 SP-c 已列 Phase 3 前置 spike，与渲染测试移植同行）；
- `loading-keys`/`multi-provider` 旧测试移植（字体栈行为的验收锚，随营销测试批移植——13 册头注的硬前置关系即本任务为其铺路）。
