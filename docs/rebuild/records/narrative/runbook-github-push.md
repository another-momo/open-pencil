<!--
  写作纪律（改本文前必读）：
  - 本文是 runbook-github-push.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/runbook-github-push.md

> **状态**：已建立 | **时间**：2026-08-24 | **核验人**：主 agent
> **物理绑定**：[runbook-github-push.md](../../runbook-github-push.md)（一一对应）
> **身份**：本档案持有 runbook-github-push.md 的建立与后续修订记录。

---

## 建立类

## 建立-1 · GitHub 推送通道手册（2026-08-24）

- **类型**：建立（按对象：runbook-github-push.md）
- **时间**：2026-08-24
- **依据**：owner 指令「总结 github 有几种推送方法、按什么顺序依次尝试，写入文档供后续复用，避免长时间盲目重试」。素材为两次实证：① 2026-08-23 T24 收口推送 github.com 数据面黑洞三连挂后自发恢复；② 2026-08-24 T25 收口补记推送 20 次重试全败（`Recv failure: Connection was reset` / `port 443 timeout`，`curl --max-time 10 https://github.com` 返回 000 实证），同期 `gh run list` 正常 → 经仓内既有 `.gh-api-push.mjs`（api.github.com Git Data REST，内容寻址 SHA 逐层校验）推送 d9823dad 成功，CI run 32740318724 正常触发全绿
- **内容**：新建 runbook——五通道盘点（HTTPS git push / gh api Git Data / SSH 22 / SSH over 443 / 代理）+ 30 秒探测分面流程 + 决策树 + 重试纪律（同通道 ≤3 次即换路）+ 禁止项（key 不入脚本、force 纪律、推送失败不静默）
- **影响**：无既有文档失效；后续推送故障按手册处置
