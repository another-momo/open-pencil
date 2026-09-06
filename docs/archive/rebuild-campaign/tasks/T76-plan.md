# T76 计划 · S4 §7 尾巴清单刷新（T-E1 可离线部分）

> 日期：2026-09-02。来源：owner 指示「网络不通就先推进其他事项」——T-E1
> （W5 收口）四件套中「Phase 3 验收执行 + 阶段门翻 ✅」阻塞于 W4 冒烟
> （等 owner 配 key），「base 候选清单归档」状态回写已随 T75 落地；本任务
> 收割剩余可离线项 = **遗留尾巴清单刷新**（S4 §7 对照 tracker/代码现状逐行
> 审计）。改动面 = 父仓 doc/S4-phase3-plan.md（非 git 仓）+ 仓内三件套与
> tracker，零代码变更。

## 1. 审计结论与落地行

### 闭合（实证在案，行标 ✅ + 删除线）

1. **active_design 事件④绑定口径**——`active-design-host.ts`
   `formDesignByFormId`（:334）+ `observeToolExecution`（:378）+
   `resolveFormAnswer`（:345/:395）机制与行述口径逐字吻合（T-B9/T60 落地）。
2. **prompt-overlay.ts / modes.ts T24 旧双模式遗留**——实际随 T62 提前
   清理：prompt-overlay.ts 头注在案（material types 段 + setup_material_type
   fallback 一并删除）；`src/app/ai/chat/modes.ts` 文件已不存在；src/ 零
   setup_material_type 活引用。
3. **GHOST 窗口规则分层**——T64 落地：check:zones 静态门禁 / drift 雷达
   分层；`.github/workflows/upstream-drift.yml` nightly cron '17 1 * * *'
   在案。
4. **image_gen_begin/commit 对 AI 可见性**（T54 核验 I2）——T72 已闭合：
   ToolDef.internal + agent/MCP 双面过滤 + 桥执行面保留 + 5 例钉扎（含 T75
   CLI 反向钉扎）。

### 进展注记（未闭合，写明卡点）

5. **base.md / system-prompt-base.md 双源收编**——组装侧已读注册表 base
   （active-design-host.ts:114 `registry.base?.body`；src/ 零 system-prompt-base
   运行时引用）；**退役半项未执行**：t46-base-fidelity.mjs 仍钉双源逐字
   一致，退役 = 删文件 + 退核验脚本，需 owner 裁决。

### 新登记（T73/T74/T75 期发现，原散见各任务文档 §4/评审报告）

6. watercolor_poster_v3 derive_palette 死链（评审 P1-02，待 owner 裁决）。
7. abort 不打断进行中长 HTTP（评审 P2-01，后续可选方向）。
8. image-gen routes 4xx 文案硬编英文（评审 P2-02，下批）。
9. 桥 /health 假阳性 + 页面侧 RPC wedge（T73 残余观察 A）。
10. 工具变更落不可见 store 观察（T73 残余观察 B，疑与 9 同源）。
11. res.on('close') 经 vite proxy 不可靠（T73 根因后路；已由带外通道补位）。

## 2. 验收标准

1. §7 四行标 ✅ 闭合（证据含文件:行号），一行进展注记，六行新登记——
   全部 grep 可读回。
2. 仓内 check:docs / check:zones 全绿（本任务零代码变更，其余门禁不适用
   但照常过）。
3. 不新增/不关闭除上述外的任何尾巴行；未闭合行原文不动。

## 3. 边界

- 父仓 doc/ 非 git 仓（git status fatal 实证），无 commit/push 面。
- 仓内仅三件套 + tracker/_index 行。
- 本任务不构成 T-E1 完全收口（验收执行仍阻塞于 W4）。
