# T71 计划 · 生图设置移除测试连接功能 + 400 错误信封统一

> 日期：2026-09-01。owner 当日两条指令：
> ①「保存生图 API 配置报错 http 400」——排查；
> ②「不是所有 provider 都支持测试连接，请去掉这个功能」——移除。

## 1. 排查结论（①）

与 owner 所填完全相同的载荷（providerType=openai-compatible、baseUrl=https://www.dmxapi.cn/v1、model=gpt-image-2-ssvip、任意 key）对临时后端实测 → **200 OK**（repro 脚本实证）。即新链路本身能收。owner 看到的 400 指向两条可能：(a) 前端是 T66-C 之前的旧构建（旧 payload 无 providerType/baseUrl/model → 命中缺字段 400）；(b) key 内含空白字符。

伴随发现的真实缺陷：缺字段 400 走 `res.writeHead(400).end(纯文本)`（routes.ts 两处），而前端 requestJSON 只解 JSON body → 用户只看到光秃秃「HTTP 400」，校验文案（明明写了）到不了界面。这解释了「报错 http 400」这一症状形态。

## 2. 改动（② + 缺陷修复）

| 文件                                        | 改动                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image-gen/routes.ts`                       | POST /api/pi/image-gen/test 端点移除（TEST_PATHNAME/handleTestConnectionRequest/ProbeFn/probe 参数全删）；两处纯文本 400 统一为 sendJSON {error} 信封       |
| `image-gen/provider.ts`                     | probeImageGenEndpoint + IMAGE_GEN_PROBE_TIMEOUT_MS + ImageGenProbeResult + ModelsListResponseBody 删除（apiErrorMessage/FetchLike 保留——generate 路径在用） |
| `image-gen/client.ts`                       | testImageGenConnection + TEST_API_PATH + ImageGenConnectionTestResult 删除                                                                                  |
| `settings/provider/ImageGenKeysSection.vue` | 测试连接按钮 + 结果行 + testConnection/testing/testResult 移除                                                                                              |
| `i18n/fork/locales/{en,zh-cn}.ts`           | imageGenTestConnection/Testing/Success/Failed 四键移除                                                                                                      |
| `tests/.../routes.test.ts`                  | 探针 describe 移除；缺字段用例加钉「400 必为 JSON 信封」；新增「/test 已移除 → 404」反向钉扎                                                                |
| `tests/.../provider.test.ts`                | 探针 describe + import 移除                                                                                                                                 |

## 3. 验收

- 全仓 grep 零残留（testImageGenConnection / probeImageGenEndpoint / imageGenTest\* / IMAGE_GEN_PROBE_TIMEOUT）。
- 门禁 unpiped 全绿：test / lint / typecheck / format / i18n / zones / smoke:pi。

## 4. 规模说明

净删改 < 200 行；但因本批与 T67-T69 同 commit 且信息面涉及 owner 排障记录，仍按三件套成文。
