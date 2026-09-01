# T71 自检 · 生图设置移除测试连接功能 + 400 错误信封统一

> 日期：2026-09-01。实施 = 主 agent（改动小且涉及刚排完的障，不派 subagent）。

## 1. 交付

按 T71-plan §2 七文件全改完：

- routes.ts：test 端点与 probe 注入参数全删；两处 `writeHead(400).end(纯文本)` → `sendJSON(400, {error})`（头注记录了「纯文本 400 只让用户看到 HTTP 400」的坑）。
- provider.ts：探针四符号删除；`apiErrorMessage`/`FetchLike` 保留（generate 路径在用，grep 实证）。
- client.ts：`testImageGenConnection`/`TEST_API_PATH`/`ImageGenConnectionTestResult` 删除；requestJSON 的 path 参数保留（签名不动其它调用）。
- ImageGenKeysSection.vue：按钮 + 结果行 + 三个关联 ref/fn 移除；头注更新。
- i18n 双 locale 各删 4 键；grep 全仓零残留（唯一命中 = routes.test.ts 里反向钉扎用的 '/api/pi/image-gen/test' 字符串，属预期）。
- 测试：routes.test.ts 探针 describe 移除，缺字段用例升级为「400 必含 JSON error 文案」钉扎，新增「/test → 404」反向钉扎；provider.test.ts 探针 describe 与 import 移除。

## 2. 排障证据（owner 问题①）

- repro 脚本（tempRoot 起真后端，POST 与 owner 所填相同载荷）→ STATUS 200 / BODY {"ok":true}。
- 结论：新链路可收；owner 端 400 的最可能解释 = 旧前端构建（payload 缺三字段）或 key 含空白字符；且无论哪种，旧版纯文本 400 都会把原因吞掉——本任务已统一 JSON 信封，重试时界面会直接显示真实原因。

## 3. 门禁（unpiped 实录）

- `bun test ./tests/engine/rebuild` exit 0（**373 pass / 0 fail** / 1577 expects；380 → 373 = 删探针 8 用例 + 新增「/test → 404」反向钉扎 1 例的净额）
- `bun run lint` 0（修掉一处 no-non-null-assertion）/ `typecheck` 0 / `format:check` 0（触碰文件已 oxfmt --write）/ `check:i18n` 0 / `check:zones` 0 / `smoke:pi` 0

## 4. 偏差

- 无领土冲突：本批改动与 T67（文档面）、T68（longform）、T69（profile/golden）零重叠；与在飞核验 subagent 只读面兼容。
- server.ts:372 调用点签名兼容（probe 参数本就带缺省值，删除后调用不变）。
