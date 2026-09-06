<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/tools-image-gen.md · 生图管线

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：生图管线、凭证链相关决策与核验。

---

## 决策类

（暂无 open 决策——F0.3② 凭证链已落地为 [01-target-state.md §2 F0.3](01-target-state.md) 块）

---

## 核验类

## 生图管线实测

- **时间**：2026-08-18 14:00
- **方法**：`ls packages/core/src/tools/image-gen/ | wc -l`
- **结论**：恰 4 文件
- **历史快照**：内置于 history.ts，随移植自带

## 生图独立凭证链（R1+R2 实测）

- **时间**：2026-08-18 14:00
- **结论**：①聊天 key 下发（`/v1/auth` provision，1h TTL）②**生图独立凭证**（key/baseURL/model 三键 + `setImageGenCredentials` 进程级注入 + 设置 UI）——无第二链 generate_image 必断（无 provider 注册，工具直接返回 error）
- **代码定位**：`agent-transport.ts:194-208`、`marketing/settings.ts:29,107-114`、`image-gen/providers.ts:83-99`、`ImageGenKeysSection.vue`