<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T60 自检 · Phase 3 W3/T-B9：宿主路由与每回合组装（active_design 单槽）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 实现段核验（2026-09-01 实测填报；落点文件:行号经实现 agent 报告 + 主 agent 抽查）

- **C1 单槽**：core active-design.ts——ACTIVE_DESIGN_KEY='activeDesignNodeId'（:50）、read/write/clear（:66-80，root sharedPluginData，空串=空槽）；身份三元组读穿（snapshotDesignRoot :116）；typeId 不读不写（T62 并行删除，旧文档残留键天然忽略）。
- **C2 四事件**：①setup_design 成功移槽 tools.ts:215 → host:376；②③端点 POST /api/pi/active-design（server.ts:175/364）→ 200 三元组+name+materialized / 422 校验驳回 / 502 bridge_unavailable / 400 缺 nodeId；③声明工具 set_active_design（active-design.ts:244，mutates:false，只回 {proposed} 不落槽）；④formId→design 映射（host:341/371，会话内不落盘；仅作答移槽，跳过/未知 formId 静默）。
- **C3 合法性校验四条件**：存在 / isMarketingDesignRoot / 同页 / briefId 一致（checkActiveDesignCandidate :161 + validateActiveDesignCandidate :187，桥探针裸数据 + 纯函数判定单源不双写）。
- **C4 悬空清槽**：evaluateActiveDesignSlot :210 + host prepareTurn——槽位节点删除 → 清槽 + 系统提示注入。
- **C5 每回合组装**：host:101 组装函数 → service.ts:236 钩子整替换；system=base+workflow(落盘 mode body)+profile 全文顺序固定；context=身份封套+历史+用户消息；空槽=general+无 profile+无封套；落盘 mode 缺失→一行系统提示+general 组装。
- **C6 一次性旗标**：host:60 + service.ts:370 入口剥离 `[新建意图确认 modeId=… profileId=…]`（字段可缺省）→ :382 finally 复位；信封-only 剥离为空 → server 400（已知边界）。
- **C7 chatMode 退役**：SessionEntry.mode/overlay 删（service.ts:108 一带）、驱逐重建语义删、modes.ts 删除；请求面残留字段忽略不报错（兼容窗）。
- **C8 物化判据钉扎**：isDesignMaterialized（active-design.ts:226）= 根框子树任一 IMAGE fill 或 hero-geometry 标记；T52 zone 标记在 brief 侧非判据。
- **C9 测试**：active-design.test.ts 21 例 + active-design-host.test.ts 23 例；`bun test tests/engine/rebuild/` 323/323；smoke:pi 76/76（t24 smoke 25 处重钉随 chatMode 退役）。

## 2. 实测修正记录

1. **lint 三错**（集成期主 agent 修正）：信封可选捕获组 `!== undefined` 守卫撞 no-unnecessary-condition（索引签名类型不含 undefined）→ truthy 守卫 + 注释；isFormTargetStillValid 空值合链 → 提前 return 改写。
2. **jscpd 克隆两例**（集成期主 agent 修正）：stack walk 习语跨 setup.ts/core active-design.ts/前端 helper 三处撞 → core 新增 walkSubtree 单源助手，isDesignMaterialized 与前端 scanDocumentBriefs/collectDesignImageRefs 收编；setup.ts 不动（避免 import cycle）。
3. **chat-mode.ts 类型文件留存**：mode-selection.ts 与 studio/manifest.ts 仍消费其 ChatMode 类型（grep 2026-09-01）——保留为类型载体，非 T24 语义残留。
4. **信封-only 消息 400**：新建意图确认卡取消后无正文场景的边界，归 W4 冒烟观察。
5. **prefix 缓存命中率实测**：无现成测量手段 → 转 W5 观察清单（plan §2.8 履约 = 组装顺序固定）。

## 3. 遗留（归核验/W4）

- 宿主 data part（确认卡/同意决定记录）随消息历史 POST 回后端——历史映射是否需跳过 data-* part，核验 subagent 复核（T61 移交项）。
- system-prompt-base/marketing.md 的引用关系随组装重构变化，内容定稿归 T-C1。
