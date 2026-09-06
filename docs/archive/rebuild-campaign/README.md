# docs/archive/rebuild-campaign

本目录为 rebuild 战役旧机制档案，冻结于 2026-09-06，禁止引用为现行规则。

> 整个目录由 mechanism-v2 workstream 仓内整治阶段（2026-09-06）从
> `docs/rebuild/` 整体 `git mv` 而来；属于历史机制档案，不参与现行
> check:zones / check:tasks / check:docs 等门禁判红。结构与原目录
> 一致——子目录命名即各叙事层 + 任务层，请按以下定位查阅：
>
> - `00-why-rebuild.md` ～ `06-zone-governance.md`：rebuild 战役叙事文档（六节）
>   - 00 战役原因 / 01 目标态 / 02 Phase 0 收口 / 03 Phase 1 runtime 演进
>   - 04 porting discipline（已退役的 patch/stub/tarball 机制条文）
>   - 05 process 文档（任务三件套自检节拍与提交门禁，旧口径）
>   - 06 zone governance（已退役的 stub/patch/tarball/deletedPaths 台账细则）
> - `README.md`、`tracker.md`：入口与总台账
> - `proposals/governance-v1.md`：v1 治理提案（已被现行治理超越）
> - `records/`：rebuild 战役副档（narrative 镜像 + topics + reviews）
>   - `records/narrative/`：与上方叙事文档一一对应的副档镜像（旧 binding 规则产物）
>   - `records/topics/`：横切主题档案（agent-runtime / brand-config / ci-infra / i18n …）
>   - `records/review-2026-09-01-code-review.md` 等：战役期 review 快照
> - `spikes/*.zh.md`：六个调研记录（dsh 集成 / pi sdk / weshop / x 设计 / harness / mode-arch）
> - `tasks/`：战役期任务三件套（T00 ～ T98 加 a/b 后缀衍生）——
>   每条任务含 `plan` / `self-check` / `verify` 三件独立文档。
> - `runbook-github-push.md`：fork push 排障手册（旧口径）
>
> 现行机制以 AGENTS.md / CONTRIBUTING.md / 工具源码（tools/zone-registry/
> tools/hooks/）为准；本目录只供历史查阅与 git 考古。如需引用某节条文，
> 请改引源码中现行实现而非本目录的旧文档。

冻结说明：本目录文件不再随主分支更新；历史 commit 内仍可追溯。
