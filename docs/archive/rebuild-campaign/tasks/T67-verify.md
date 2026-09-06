# T67 核验 · prompt 退役/挖掘 + S 文档同步

> 日期：2026-09-01。核验 = 独立 subagent（只读），结论转存本文。**总结论：PASS**（附 1 处自检失实已随 T68 补写闭环，见末节）。

## 逐项裁决

| 项                        | 结果                      | 关键证据                                                                                                                                                 |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 孤儿断言               | PASS                      | `git show HEAD:...system-prompt-marketing.md` 可读 + git status `D`；运行时 grep 零引用；两 T45 脚本复制清单只剩 base                                    |
| V2 装配事实               | PASS                      | active-design-host.ts:114-130 段序 base→workflow→profile；service.ts:282 兜底 = studio base body                                                         |
| V3 挖掘清单→longform 吸收 | **原 FAIL → 补写后 PASS** | 见末节                                                                                                                                                   |
| V10 S 文档同步抽查        | PASS                      | S1 四处（typeId→canvas / :111 当前页口径 / §6 两轴 / §9 分割线回执）+ S3 §2 setup 契约 `{modeId, profileId?, briefId, canvas?}` 均带 2026-09-01 T67 注记 |
| 门禁复跑                  | PASS                      | 见 T68-verify §门禁（同批合跑）                                                                                                                          |

## V3 缺口与闭环（主 agent 补写，2026-09-01）

核验发现的 longform 吸收缺口（同步计入 T68 FAIL）：①Section 模式库（清单 :158-179）整节未见落点；②create_brief「ambiguous 不建」纪律（清单 :59）未见；③:49 修改路径段仅弱命中。主 agent 补写：longform.md 新增「歧义纪律」段（阶段 0）、「修改请求路由」段（restyle 节首）、「Section 模式库」节（四则 + W 参数化声明）。补写后 `bun test` 0 / `smoke:pi` 0 / lint 0 / format 0，longform 156 行（≤200 自控线）。T67-self-check §3 的「逐项 grep 命中」声明自此成立。
