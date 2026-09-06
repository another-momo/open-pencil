<!--
  写作纪律（改本文前必读）：
  - 本文是 02-phase-0.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/02-phase-0.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[02-phase-0.md](../../02-phase-0.md)（一一对应）
> **身份**：本档案只持有针对 02-phase-0.md 的腐烂/修正/核验记录。**完整 [02-phase-0.md §0](02-phase-0.md) 执行期修正明细（8 条）保留在 `records/topics/docs-governance.md` 修正-2**——本档案只留指针，避免双向源污染。

---

## 腐烂类（派生自 records/topics/docs-governance.md ROT-5~14）

## ROT-5 · 02 v1 locale 删 8 收 zh-cn+en

- **派生自**：`records/topics/docs-governance.md` ROT-5
- **错误**：locale 删 8 收 zh-cn+en
- **实况**：R3：上游 9 locale = en + 8 翻译（含 zh-CN），应删 7
- **处置**：v2 已修正

## ROT-6 · 02 v1 i18n 缝用 mergeLocaleMessage

- **派生自**：`records/topics/docs-governance.md` ROT-6
- **错误**：i18n 缝用 mergeLocaleMessage
- **实况**：R3：API 虚构，上游为 @nanostores/i18n
- **处置**：v2 已修正

## ROT-7 · 02 v1 IS_TAURI「18 处动态 import」

- **派生自**：`records/topics/docs-governance.md` ROT-7
- **错误**：IS_TAURI「18 处动态 import」
- **实况**：R3：37 处/16 文件、动态 import 29 处
- **处置**：v2 已修正

## ROT-8 · 02 v1 路由与切断点计数

- **派生自**：`records/topics/docs-governance.md` ROT-8
- **错误**：`/share/:id`、EditorView 切断 1 处、presence 1-3 处
- **实况**：R3：`:roomId`；EditorView 单文件 5+ 处
- **处置**：v2 已修正

## ROT-12 · 02 v2 tauri 需 stub 壳

- **派生自**：`records/topics/docs-governance.md` ROT-12
- **错误**：tauri 需 stub 壳
- **实况**：Agent A 实测：静态 import 遍布 ~20 文件，保持纯净 + 保留依赖即可
- **处置**：02 已修正（详见 `records/topics/docs-governance.md` 修正-2 第 1 条）

## ROT-13 · 02 v2 .lfsconfig 改指自有 LFS + CI 补 7 处 lfs

- **派生自**：`records/topics/docs-governance.md` ROT-13
- **错误**：`.lfsconfig` 改指自有 LFS + CI 补 7 处 lfs
- **实况**：自有 LFS 超额、上游网关匿名可读、剩余 workflow 不需要补
- **处置**：02 已修正，P21 撤销（详见 `records/topics/docs-governance.md` 修正-2 第 2 条）

## ROT-14 · 02 v2 i18n 缝落位 src/app/i18n/ 根

- **派生自**：`records/topics/docs-governance.md` ROT-14
- **错误**：i18n 缝落位 src/app/i18n/ 根
- **实况**：上游 #557 已占用该目录（notifications/），缝避让至 fork/ 子目录
- **处置**：02 已修正（详见 `records/topics/docs-governance.md` 修正-2 第 4 条）

---

## 修正类

## 修正-2 · 02-phase-0.md v2 §0 执行期修正节迁移

- **类型**：修正（按对象：02-phase-0.md）
- **派生自**：`records/topics/docs-governance.md` 修正-2
- **原文位置**：[02-phase-0.md](../../02-phase-0.md) 旧版 §0「执行期修正」（8 条，已删除）
- **迁移去向**：`records/topics/docs-governance.md`「02-phase-0.md 执行期修正明细」章节
- **影响**：02 §0 删除，正文（§1-§6）已同步体现新版本；02 头部加纪律块 + 统一 HH:MM 时间

---

## 核验类

## R3 · 02 上游删除目标

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent C
- **范围**：[02-phase-0.md](../../02-phase-0.md) 上游删除目标 + 配置连带面
- **结论**：删除目标均在；修正：locale 删 7 留 zh-CN、mergeLocaleMessage 虚构（实为 nanostores i18n）、IS_TAURI 37 处/16 文件、EditorView 切断点 5+、配置连带面（package.json/knip/steiger/oxlint）、browser-bridge 冲突、CI lfs 需补 7 处、registry.ts 9 行组合文件 + registerComponentCatalog 先例
- **影响**：02 已修正为 v2

## P0-1 ~ P0-10 · Phase 0 验收核验

- **派生自**：`records/topics/ci-infra.md` P0-1~P0-10
- **结论**：Phase 0 gate review 通过——详细见 `records/topics/ci-infra.md`

## P0-8 · Phase 0 gate review 机械审计

- **派生自**：`records/topics/docs-governance.md` P0-8
- **结论**：patches P1-P24 全部真实、deletedPaths 44 条全落实、ownedRoots 零例外；发现 check.ts 4 漏洞 + 02 正文 7 处残留矛盾 + 2 处计数错 → 全部整改；fonts 测试复跑 77/0 绿；PWA 零残留实证

---

## 修正-N · 02-phase-0.md §5 #2「CI 已接线」声称证伪（T09）

- **类型**：修正（按对象：02-phase-0.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-15）
- **内容**：§5 验收第 2 条「CI 已接线 check:zones」实测不实（四检查从未进 workflow；grep + git log -S 双证伪）；正文改为如实记录，T09 起经 rebuild-discipline job 真正接线
- **影响**：Phase 0 验收记录恢复可信；gate review 步骤 1-5 的「已自动化」从此有 workflow 文件佐证

## 修正-N · 02 §3.3 pending-reclass 清单刷新 + §3.4【决策】标注 + 裸引用修正（2026-08-25 三方 review 整改）

- **类型**：修正（按对象：02-phase-0.md）
- **时间**：2026-08-25
- **依据**：三方 review 发现——§3.3 清单仍列 `src/app/ai/providers/`、`src/app/ai/models/`、`src/app/ai/attachment/`、`src/app/ai/vision-runtime.ts`，实测均已随 T25 删除出仓（`ls src/app/ai/` 仅剩 chat/debug/pi-backend/tools；对照 zones.json pendingReclass 实测，2026-08-25）
- **内容**：§3.3 清单按 zones.json pendingReclass 当前态重写（chat/、tools/、debug/index.ts、components/chat/、ChatPanel.vue、automation/、mcp/、browser-bridge.ts、cli/、workflows 4 个）；§3.4 两条缝合缝补【决策】标注；正文「见 §3 机制建设」裸引用补全文件名；头部时间刷新为 2026-08-25（原头部时间停在 T09 修正 2026-08-21，T09 后状态字段未刷新问题一并处理——原时间信息移入「原验收时间」行保留）
- **task 文档**：无独立 task（T26 统一登记）

## T32 修正-N（2026-08-26） · §3.3 末尾追加 §3.x 补充段

- 改动：`docs/rebuild/02-phase-0.md` §3.3「重分类仪式」段后追加 §3.x 补充段，指向 04-porting-discipline.md §5「owned/follow/tarball 三态边界判定」。
- 理由：tarball/tarball 替换式合并的 path 登记走 zones.json 新增 `upstreamMergeTarball` 顶层字段（机器可解析），不走 ownedFile 也不走 patch——边界判定规则集中维护在 04 §5。
- 详见：[tasks/T32-plan.md §3 S7](../../tasks/T32-plan.md)
