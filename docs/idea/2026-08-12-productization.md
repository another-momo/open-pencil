# 长卷（Changjuan）产品化方案：从 fork 到独立产品

> 状态：草案 / 讨论已定大方向，待逐项执行
> 创建日期：2026-08-12
> 背景：fork 自 open-pencil 以来，`feature/marketing-workbench` 分支已积累 330+ commit（AI 营销工作台、需求单工作流、风格档案、生图管线等），方向与上游（通用设计编辑器）已实质分化。本文档固化当天讨论的全部产品化决策，作为后续工作的基准。
> 关联文档：`docs/plans/architecture/fork-divergence.md`（fork 治理）；`docs/idea/2026-08-12-electron-migration.md`（Electron 迁移方案——**本文结论与之冲突，见 §5.4**）；`docs/idea/2026-08-13-localhost-serve-form.md`（§5 形态的落地方案）

---

## 一、为什么要现在产品化

- 分叉已越过"改 bug"阶段：需求单工作流、风格档案库、生图管线（历史图片备份 / 参考图合成 / 落位规避）构成了一套上游没有的产品能力，继续以 fork 心态维护，定位模糊、合并债累积。
- Build in public 的实际收益是纪律：README、changelog、issue、版本节奏倒逼"自己能用"变成"别人能跑"。
- 法律层面零障碍：上游 MIT 许可证，唯一义务是保留原始版权声明（Danila Poyarkov）。

## 二、差异化切口：长图

**结论：不做"宽泛的营销图片设计"，切长图（产品长图 / 电商详情页 / 课程活动长图）。**

理由：

1. **纯文生图和模板工具都啃不动中间地带。** 纯 AI 生图产出扁平位图，长图文字密集、结构分节、要反复改稿，位图没法改；稿定/创客贴类模板工具能改不能"生成"。本项目的混合路线（AI 在真实画布上操作矢量/文字图元，仅装饰槽位走生图）产出**分层可编辑的长图**——这是护城河，也是 landing page 的第一句话。
2. **单件价值高。** 详情页/产品长图是商家真金白银外包购买的品类，付费意愿真实。
3. **工程积累已就位。** 固定宽度 + 纵向 hug、分节脚手架、hero bleed + backdrop fade（`compose_backdrop`）、素材类型系统（`product_long` / `ecommerce_detail` 等 7 种，注册表在 `public/default-library.fig` 的 Types 页）——这些本来就是长图专用机制。
4. **窄切口叙事立得住。** "营销图片设计"的竞争对手是所有人；"AI 长图"赛道并非无人——鹿班、稿定 AI、美图设计室等都在附近——但它们的产出是位图或模板，不是可编辑的分层文件。差异不押在"没人做"上，押在第 1 条的"每一寸都能改"上。

风险与纪律：

- 长图是强中文市场品类，切它约等于先 All-in 中文市场，产品语言/文案/渠道随之。这带来两个硬约束：目标用户大概率拿不到 OpenAI/Anthropic 官方 key（见 §6、§9.2），GitHub/npm 分发渠道国内可达性差（见 §9.6）。
- 收窄最难的是坚持：架构保留多素材类型能力（现状即如此），但产品表面前 6 个月不加新品类。
- 定位句：**"AI 生成长图，但每一寸都能改。"**

## 三、品牌：长卷 / Changjuan

**候选排查结果（2026-08-12）：**

- App Store 中国区：无同名 App ✅
- 网页搜索：无同名设计工具 / AI 产品 ✅（"长卷"仅作普通名词出现，正是想要的文化联想：清明上河图、千里江山图）
- GitHub：5 个同名小仓库（0–1 star），其中一个 `WenLiux/wenl-changjuan-psd-slice-exporter`（2026-08 创建，PSD 切片工具）说明该词正被设计工具圈捡起——**要用趁早**；仓库名 `another-momo/changjuan` 不受他人仓库影响
- 域名：`changjuan.com` ❌ 已注册；`changjuan.design` ✅ 未注册（RDAP 404 + NXDOMAIN 双重确认），对设计工具反而贴切
- 商标：中国商标网无法程序化查询，**需人工查第 9 / 35 / 42 类**，确认后尽快自助注册（官费约 270 元/类）——公开运营前唯一必须人工完成的一步

**叙事资产：** "古有千里江山图，今有 AI 长卷"；"卷"自带展开/生长的动作感，与 AI 逐节生成的体验暗合。拼音 changjuan 走"稿定 Gaoding"路线。

## 四、仓库策略：原地独立，不新建

顺序（前四步为代码与设置操作）：

1. 上游合并完成、CI 绿（公开基线必须新）
2. rebrand 分支：LICENSE 加自己的版权声明（保留 Danila 的）、README 重写（含 "built on open-pencil (MIT)" 归属说明）、品牌字符串替换（清单见 §7.3）
3. GitHub Settings → Danger Zone → **Leave fork network**（保留全部 commit/分支/issue；不可逆，但不亏——本就不往上游提 PR）
4. 仓库改名 `changjuan`（GitHub 自动保留旧名重定向）
5. 默认分支切到产品分支（考虑改名 `main`），开启 Issues，写 description/topics

**为什么不新建仓库：** 所有工作历史、CI 记录、治理文档都在现有仓库；fork 身份对公开产品的实际损害是代码搜索不索引、Issues 默认关闭、仓库页挂 "forked from" 标签——Leave fork network 全部解决。脱离后本地 `upstream` remote 不受影响，原合并流程零变化。

**对上游的新心态：** 产品独立后，上游从"跟进的主线"降级为"编辑器核心的零件供应商"，月度 merge 降为按需 cherry-pick。

## 五、产品形态：本地 CLI 后端 + localhost Web UI（Kimi Code 模式）

### 5.1 结论

收敛到**单一形态**：`changjuan` 命令（或双击二进制）→ 起本地 server → 静态托管前端 + 跑 agent loop + 提供字体/文件 API → 自动打开浏览器。砍掉 Tauri、MCP（对外功能）、ACP 三种形态，公开 Web 版随之淘汰（§7.1）。

### 5.2 它解掉的痛点

| 痛点 | localhost 模式的解 |
|---|---|
| 云服务器/运维/备案/服务端国内可达性 | 不存在——用户本地跑 |
| Web 版 AI 请求 CORS | 本地后端发出，无 CORS；dev-proxy hack 进坟墓 |
| 自有字体库管理 | 后端扫本地字体目录、喂字体二进制给 CanvasKit；字体库=磁盘目录，版权责任在用户侧 |
| 文件管理 | 真实文件系统，摆脱 File System Access API 的浏览器兼容性（Safari 残废问题消失） |
| key 存储 | 本地配置文件，不碰钥匙串也不碰 localStorage |
| Tauri 性能问题（WebView2/WebKit） | 用户自带 Chrome/Edge，WASM 重负载的最佳运行时 |
| 分发 | `bun build --compile` 单文件二进制或 npm 包（签名/安装体验的现实成本见 §5.4） |

### 5.3 AI 卡住的诚实拆解

卡住有两层来源，本方案只根治第一层：

- **编排层（根治）**：agent loop 驱动、LLM 流式、生图/vision 长网络等待、重试——挪到本地后端，前端彻底解放。
- **执行层（缓解不根治）**：`render` / `compose_backdrop` / `look` 实际在浏览器里操作场景图和 CanvasKit，场景图住在哪活就得在哪干。v2 方向：后端持有 headless 编辑器实例（CLI 已能无头跑 core），浏览器变纯视图。

### 5.4 与 Tauri / Electron 的对比结论

- **vs Tauri**：免去 Rust 工具链、分平台 Tauri 打包、WebKit 的 WASM 短板；全栈统一回 TypeScript。代价：失去原生集成（dock/菜单/文件关联）、多一个本机 HTTP 端口的安全面（绑 127.0.0.1 + token + 防 DNS rebinding）、生命周期脏活（端口冲突/僵尸进程）自理——MCP server 已有 token 鉴权与 transport 发现的底子。
- **vs Electron**：Electron 的 main process 本质也是本地后端，被否决的迁移方案同样覆盖了字体管理、HTTP 代理、对话持久化等痛点——这些不是否决它的理由。真正的理由是分发的重量：150MB+ 包体、分平台打包与自动更新管线，而"桌面壳"对产品形态没有增益——用户的浏览器 Tab 就是桌面。**据此否决 `docs/idea/2026-08-12-electron-migration.md` 的方向。**
- **分发的诚实成本（对 Tauri/Electron/裸二进制一视同仁）**：任何本地二进制分发都绕不开代码签名——未签名二进制在 macOS 被 Gatekeeper 拦截、在 Windows 触发 SmartScreen；npm 分发则假设用户装有 Node/Bun。vs Tauri 省掉的是 Rust 工具链和 WebView 短板，**不是**签名与公证本身。目标用户是非技术的商家/运营，安装与启动体验（双击二进制、杀软误报、端口占用提示）是这条形态路线的最大未解风险，单列待拍板（§9.5）。
- **架构未来性（最关键）**：localhost 模式强迫前后端分离，将来演进 SaaS = 把同一个 server 部署上云 + 加账号；桌面壳路线则容易把一切耦合在客户端。

### 5.5 已有骨架（工作量是集成不是开荒）

- `packages/cli`：无头跑 core 的 CLI
- `packages/mcp`：localhost HTTP server（Hono，transport 发现 + token 鉴权）——对外 MCP 功能砍，**server 骨架留下当产品底座**
- `src/app/automation/`：编辑器桥接通道

### 5.6 砍法分两刀

- **第一刀（产品化时）**：只切发布面与界面——`build.yml` 砍掉 Tauri 打包（当前仅 Windows x64 单平台，本就无 npm 发布步骤）、界面藏掉 ACP/collab 入口。代码全部暂留：`packages/cli` 与 `packages/mcp` 是 localhost 形态的底座（§5.5），且与 core tools 耦合，物理删除会让每次合上游收获 deleted-vs-modified 冲突。
- **第二刀（产品独立站稳、上游改为 cherry-pick 后）**：物理删除 `desktop/`、`packages/mcp` 对外层、`src/app/ai/acp/`，`packages/cli` 改造为产品入口（`changjuan serve` 的家），清理 20+ 文件的 `IS_TAURI` 分支（实测 23 个文件，含非代码文件；纯源码约 18 个）。

## 六、零云后端路线：能力垫法

"v1 不需要自有**云**后端"（本地 server 是产品形态本身，见 §5）——每块需求用最便宜的方式垫住，把"上不上云"推迟到产品验证之后：

- **字体库 v1**：本地字体目录扫描（§5.2），字体库=磁盘目录。不做公开静态托管的字体库——托管字体文件有再分发授权问题，且 localhost 形态下没有必要。内置字体清单（JSON）仅用于随二进制分发的开源字体。真正的"团队共享品牌字体库"等验证后再升级（届时才需要云）。
- **AI 通道（BYOK）**：所有 provider 请求统一由本地后端发出，key 存本地配置文件。目标用户以国内商家/运营为主，官方 OpenAI/Anthropic key 对他们基本不可得，provider 清单必须覆盖国内可直连的模型服务——与 §7.2.2、§9.2 联动。内置计费、key 代管等收入出现时再上。
- **文件管理**：真实文件系统（§5.2）。上游 local-first 的 IndexedDB 缓存与 S3 兼容云存储（用户自填 bucket）作为可选高级能力保留，不宣传。

国内市场的真实约束，localhost 形态绕开的是**服务端**部分：托管位置的国内可达性、内置计费生成式 AI 服务的备案/合规。绕不开的是**分发**部分：GitHub Releases / npm 国内不稳，国内镜像或对象存储分发需要 ICP 备案（周期两三周）——列入 §9.6 待拍板。

## 七、现状盘点（2026-08-12 调研，事实依据）

### 7.1 已就位（无需重做）

- 凭据管理器：Tauri 系统钥匙串 / 浏览器 WebCrypto IndexedDB；provider 连接 / 模型档案 / 角色指派三层结构 + Settings UI
- i18n：9 个 locale（en 内建 + 8 个翻译目录），zh-cn 与英文键数完全对齐；营销工作台文案基本已走 i18n
- Tauri updater 已配置且 endpoint 已指向 fork 仓库 releases（但随 Tauri 一并淘汰）
- 无任何遥测
- CHANGELOG 纪律：上游 `CHANGELOG.md` 不动，fork 变更记 `CHANGELOG.fork.md`
- Web 部署管线（Cloudflare Pages，tag 触发）——随 §5.1 单一形态决策**淘汰 app 部署**（文档站如需保留，另行处理）

### 7.2 工程债（公开前必须修）

1. **生图 API key 存 localStorage**（`src/app/ai/marketing/settings.ts` 的 `useLocalStorage`），违反仓库自己的凭据管理约定——迁入 CredentialManager（或 localhost 形态的配置文件）。
2. **默认生图通道硬编码 `dmxapi.cn` + `gpt-image-2-ssvip`**（`settings.ts:29-37` 与 `packages/core/src/tools/image-gen/providers.ts:79-81` 双重硬编码）——公开产品不能把第三方付费中转站当默认值，需去默认化或另有安排。注意这个默认值的存在本身印证了 §6 的判断：目标用户需要国内可达的模型通道。**（待拍板，见 §9.2）**

### 7.3 品牌替换清单（rebrand 分支用）

窗口标题 / productName（`desktop/tauri.conf.json:3,15`）、bundle id `net.dannote.open-pencil`、macOS 签名证书（上游作者的）、凭据服务名（`desktop/src/credentials.rs:4`）、MCP 配置目录（`src/app/automation/mcp/spawn.ts:99,102`）、localStorage 前缀 `open-pencil:`、OpenRouter 请求头（`src/app/ai/providers/registry.ts:22`）、页面标题模板（`src/App.vue:15`、`index.html:11`）、logo alt（`AppMenu.vue:64`、`EditorView.vue:191`）、原生 About 菜单（`desktop/src/menu.rs:69,72`）、CodePanel 标签（`CodePanel.vue:107`）、两处错误文案（`vite-plugin.ts:52`、`acp/transport.ts:70`）。——随 Tauri 淘汰，带 `desktop/` 的条目自然消失。

### 7.4 长图能力缺口（差异化功能机会）

- **切片/分段导出完全没有实现**（grep 确认）：小红书九宫格、朋友圈切图是长图真实交付场景，值得作为产品功能做。
- 无 onboarding / 模板 / 示例：打开即空白 "Untitled" tab。长图产品的首屏需要"需求单→生成"的引导路径。

### 7.5 内部边界

- `docs/` 下 50 个内部文件（plans / review / research / idea）公开前去留待定；README / CHANGELOG 仍是上游原文（rebrand 时重写）。
- 小尾巴：`ChatModeSection.vue` 下拉硬编码英文；上游协作（Trystero P2P）与 S3 云存储保留不宣传。

## 八、执行路线图

按依赖排序，每步独立完成：

1. **上游合并**（`merge/upstream-*` 分支，CI 盯绿）——公开基线先要是新的
2. **生图凭据入凭据管理器** + 去 dmxapi 硬编码默认值（修法依赖 §9.2 拍板，先拍板再动手）
3. **rebrand 分支**：LICENSE / README / 品牌字符串 / `ChatModeSection` 英文尾巴
4. **仓库操作**：Leave fork network → 改名 changjuan → 默认分支切产品分支 → 开 Issues（人工，GitHub 设置）
5. **商标三类查询 + 注册 `changjuan.design`**（人工）
6. **第一刀切除**：build.yml 砍 Tauri/npm 发布面，界面藏 ACP/collab
7. **localhost 产品入口**：组装 `changjuan serve`（MCP server 骨架 + 静态托管 + agent loop 后端化编排 + 字体/文件 API）
8. **字体库 v1**（本地目录扫描 + 内置开源字体清单）
9. **切片导出**（长图差异化功能）
10. **首屏/onboarding**：需求单一级对象化（含此前遗留：需求单绑定编辑 UI、原始输入带入、不自动弹面板）
11. **第二刀物理删除** + 上游转 cherry-pick 节奏

## 九、待拍板事项

1. **入口形态细节**：营销工作台抬为产品主角后，通用编辑器能力是"默认收起"还是"另一模式"——倾向前者，待首屏设计时定。
2. **默认生图通道**：dmxapi 去默认化（用户必填自己的 key）vs 与 DMX 安排 vs 自建转发——影响 §7.2.2 的修法。注意与目标用户的联动：国内商家大概率没有官方 key，provider 清单怎么覆盖国内可直连模型是同一个问题。
3. **商标与域名**：人工动作，宜早不宜迟（已有同名设计工具出现）。
4. **SaaS 演进触发条件**：什么信号（用户量 / 收入 / 需求强度）启动"同一 server 上云 + 账号体系"。
5. **非技术用户的安装与启动体验**：双击二进制路线的代码签名/公证（macOS Gatekeeper、Windows SmartScreen）、杀软误报、端口冲突提示；npm 分发路线则要求用户预装 Node/Bun——两条路对商家/运营人设都不算顺，需要实测后定主分发方式。
6. **国内分发渠道**：GitHub Releases / npm 对目标用户可达性差；国内镜像或对象存储分发涉及 ICP 备案。是否备案、何时备案，与 §9.5 的主分发方式一起定。
