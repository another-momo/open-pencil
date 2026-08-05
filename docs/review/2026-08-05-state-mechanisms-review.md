# 状态机制全景梳理（2026-08-05）

> 范围：`feature/marketing-workbench` 分支 HEAD。目的：盘点代码库中所有记录"状态"的机制，区分持久化与内存级，标注 fork 新增 vs upstream 固有，并标出可疑设计。
>
> 行号基于调查时点的 HEAD，后续改动可能漂移，以文件路径为准。

## 总览

全库**没有 Pinia**，状态按"存到哪、活多久"分四层：

| 层 | 载体 | 生命周期 | 典型代表 |
|---|---|---|---|
| 一、文档层 | pluginData 标记 + 普通场景节点 | 随 .fig 保存/重开 | 营销标记、需求单帧 |
| 二、浏览器/系统持久化 | localStorage / IndexedDB / 钥匙串 | 重启保留，与文档无关 | model profiles、营销设置、凭证 |
| 三、内存 per-document | `WeakMap<SceneGraph/EditorStore, …>` | 随 graph/store GC | 营销注册表、库会话、聊天消息暂存 |
| 四、内存全局单例 | 模块级 `let`/`ref`/Map | 进程存活期 | 聊天会话、core 凭证变量、各类缓存 |

分层思路本身清晰：**文档拥有的状态走 pluginData/节点，会话拥有的状态走 WeakMap，用户偏好走 localStorage**。问题集中在第四层（见"可疑设计"）。

---

## 一、持久化到文档层（随 .fig 走）

全部为 fork 新增。

### 1. 营销 pluginData 标记（pluginId `open-pencil-marketing`）

- 内容：根帧 `role=marketing-root` + `material-type` + `library`（制作所用库文件名）；锚点 `role=marketing-anchor` + `anchor-template`/`anchor-position`/`anchor-component`；素材参考克隆 `role=library-reference` + `library-ref`。
- 写入：`packages/core/src/tools/marketing/restore.ts:50-109`（`markMarketingRoot`/`markMarketingAnchor`/`markLibraryReference`），调用点 `setup.ts:165,243,293`。
- 读取：`restore.ts:174-209`（`restoreStateFromCanvas`，重开文档后惰性重建）、`restore.ts:135-148`（`listDocumentLibraryNames`，检测库不匹配）、`registry.ts:23-31`（ensureRestored）。
- 生命周期：`setup_material_type` 或素材注入时写入；节点被删后 registry 惰性剔除；随 .fig 序列化往返。

### 2. 需求单（brief）帧

- 内容：`role=brief` 标记的 FRAME，内含内容区/素材区/AI结论区三组普通 TEXT/FRAME 节点；AI 确认的结论以文本行追加进 AI结论区。
- 写入：`packages/core/src/tools/marketing/brief.ts:269-296`（createBrief）、`brief.ts:459-479`（appendToBriefAiZone）。
- 读取：`brief.ts:48-67`（isBrief/findBrief）；agent 经 read/look 工具读文本。
- **设计亮点**：locked direction、campaign facts 等"显式状态"故意只存在这里，不进任何内存注册表（`restore.ts:8-10` 注释），是全库最干净的一块状态设计。

### 3. 营销生成的普通节点

Components 页克隆的组件、根帧、渲染出的 section、素材区注入的参考节点，全部是普通场景节点，天然随 .fig 持久化（`setup.ts:104-111,153-167`、app 层注入 `src/app/ai/marketing/library.ts:278-301`）。

### 4. upstream 固有

pluginData 机制本身 + 导出设置（`packages/fig/src/node-change/plugin-data.ts:29-53`）。

---

## 二、持久化到浏览器/系统（重启保留，与文档无关）

### localStorage

**fork 新增**（全部在 `src/app/ai/marketing/settings.ts`，`useLocalStorage`，改动即写，永不自动失效）：

| key | 内容 | 位置 |
|---|---|---|
| `open-pencil:chat-mode` | ui/marketing 模式 | :52 |
| `open-pencil:ai-look-images-kept` | 媒体省略保留最近 N 张图 | :27 |
| `open-pencil:image-gen-api-key` / `-base-url` / `-model` | 图像生成凭证 | :29-37 |
| `open-pencil:ai-vision-mode` / `vision-provider` / `vision-api-key` / `vision-base-url` / `vision-model` | vision 通道 B 凭证五件套 | :42-49 |

⚠️ image-gen 与 vision 的 API key 是**明文 localStorage**，与聊天凭证（加密 IDB/钥匙串）安全等级不一致。写读逻辑见 `vision-settings.ts:31-64`（key 不回显、空不覆盖）。推送到 core 的 watch：`settings.ts:107-140`。

**upstream 固有**：

- `open-pencil:ai-model-settings` — model profiles（versioned JSON：connections/models/assignments），`src/app/ai/models/storage.ts:4-9`，写入 `store.ts:186`（deep watch），读取/校验/迁移 `store.ts:99-186`；遗留 6 个旧 key 仅作迁移读取（`storage.ts:11-40`）。
- `open-pencil:credential-persistence`（remembered/session）— `settings/credentials/storage.ts:1,22-31`。
- 其他：编辑器布局、主题、在线字体及字体源、矢量化 provider、云存储偏好、协作昵称、语言、Safari 提示等十余个。
- 缓存命名空间 `open-pencil:cache:v1:*`：OpenRouter 模型列表（24h TTL）、字体缓存。

### IndexedDB（均 upstream 固有）

- `open-pencil-cloud-local`：云同步本地镜像（含完整 fig 字节），`storage/local-store/idb.ts:6-24`。
- `open-pencil-cloud-outbox`：持久化同步队列（带重试退避），`storage/sync/outbox.ts:4-31`。
- `open-pencil-credentials`：浏览器端加密凭证库（AES-GCM），`settings/credentials/browser.ts:12-54`。
- `op-room-${roomId}`：协作房间 Yjs 离线持久化，`collab/session.ts:170`。
- 降级：IDB 不可用时 local-store/outbox 退化为内存（有显式探测标志）。

### 系统钥匙串（Tauri，upstream）

`desktop/src/credentials.rs`：service `net.dannote.open-pencil.credentials`，Tauri 下优先于浏览器加密 IDB。

### 文件系统

- .fig 保存（`document/io/save.ts:47-95`）+ 自动保存（sceneVersion 变化防抖 3s，`document/autosave/create.ts:20-32`）+ 外部变更监听重载。
- **[fork] `public/default-library.fig`**：构建期资产，运行时 fetch（`marketing/library.ts:34,67-83`）；用户上传的自定义库**只在内存，不写盘**。

---

## 三、内存级 per-document（WeakMap 键控，随 graph/store GC）

fork 的主要模式，设计健康。

### 营销注册表（core）

- `states: WeakMap<SceneGraph, Map<rootFrameId, MarketingDocumentState>>` — `packages/core/src/tools/marketing/registry.ts:14`。含 `lastActiveAt`。创建：首访时 `ensureRestored()` 从画布 marker 重建；清理：root frame 消失时惰性 prune（:60,69）；多设计且活跃 root 丢失时故意不 prune（:79-84 注释，有意设计）。
- `restoredGraphs: WeakSet` :15、`activityClock: let` :16（单调计数器充当时间戳，仅会话内排序用）。
- 文件头注释明确 "not persisted into the document file"，持久化完全靠画布 marker。

### 素材库

- core：`sessions: WeakMap<SceneGraph, LibrarySession>` — `marketing/library.ts:381`，per-document 绑定，每次 AI turn 的 `prepareCall` 重绑（`transports.ts:126`）。
- app：`src/app/ai/marketing/library.ts:37` `current: shallowRef` — **全局单例而非 per-document**，所有文档共享同一个库；`replaceMarketingLibrary` 影响全部文档，靠下次 prepareCall 重绑收敛（有意设计）。`dialogAutoShown` :238 每次 app 运行只自动弹一次，从不复位。

### 聊天消息暂存

`currentChatMessages: WeakMap<EditorStore, UIMessage[]>` — `transports.ts:206`，切 tab 保留历史（但见可疑项 W1）。

### 工具运行状态

`runStates: WeakMap<EditorStore, RunState>` — `src/app/ai/tools/index.ts:66`（见可疑项 W2）。

### EditorStore（每 tab 一个，`editor/session/create.ts:26`）

- `state: shallowReactive`：选择、hover、marquee、viewport、版本计数器等全部运行时 UI 状态，随 tab 关闭 dispose。
- Undo 栈：`packages/scene-graph/src/undo.ts`，上限 200 条，AI 工具按 burst 合并省内存；打开文件时清空；**从不持久化**。
- SkiaRenderer 缓存群（`canvas/renderer.ts:65-157`）：image/vector/geometry/picture/scene 十余个缓存 Map，全部靠版本计数器失效，key 相同覆盖写自然有界。

---

## 四、内存级全局单例（进程存活期，风险集中区）

- **聊天会话**（`transports.ts` `createChatSessionManager` 闭包）：当前会话全部消息历史只在内存（见 W1）。
- **core 层凭证变量**：vision 五件套（`marketing/vision.ts:16-20`）、image-gen（`image-gen/providers.ts:47-69`）、stock-photo（`stock-photo/providers.ts:23-102`）——模块级 `let`，全局共享、只被覆盖、从不清空。
- **model profiles 内存权威**：`aiModelSettings: ref`（`models/store.ts:184`）+ deep watch 写 localStorage，同步持久化，这块是健康的。
- **凭证存储切换**：`appCredentialStore`（`settings/credentials/app.ts:30`）：Tauri→钥匙串；浏览器→加密 IDB 或 MemoryCredentialStore（"不记住"时重启即丢，有意设计）。
- **各类缓存**：OpenRouter 模型列表 Promise（失败后整会话不重试）、字体解析/摘要/族缓存（从不失效，key 域有界）、图标缓存、CanvasKit WASM 单例等。

---

## 可疑设计（按严重程度排序）

### W1（最高）：改任何模型设置即静默丢失全部聊天记录

`markTransportDirty()`（`transports.ts:211`）把 per-document 消息 WeakMap **整体换新**——改个 baseURL、切个 chatMode、改任何模型设置，所有文档的聊天历史立即丢弃。叠加"聊天历史本就全内存、重启即丢"，这是全库最像 bug 的状态设计。

**建议方向**：transport 重建时把消息历史迁移到新 WeakMap（chat 消息与 transport 本应解耦）；长期可考虑会话持久化。

### W2：toolLog 只增不减

`RunState.toolLog`/`stepUsages`（`tools/index.ts:40-41`）每次工具调用追加一条含 args/result 快照的记录，无上限、无自动清理（仅手动 `clearToolLogEntries`）。长 AI 会话内存线性增长。

**建议方向**：环形缓冲（保留最近 N 条）或按 burst 滚动清理。

### W3：chip 状态与文档脱节

`materialTypeSelection`/`profileSelection`（`settings.ts:63,87`）是纯内存 ref，重启即丢；但设计本体靠 canvas marker 持久化——重开文档后"文档有类型、chip 空白"，状态不对称。可能是有意的 session 语义，但与用户预期不符。

**建议方向**：打开文档时从 marker 回填 chip（与 `restoreStateFromCanvas` 同源），或明确接受 session 语义并在 UI 上体现。

### W4：image-gen/vision 凭证明文 localStorage

与聊天凭证（加密 IDB/钥匙串）安全等级不一致。D1（vision 迁移到 model profiles）落地后自然消解 vision 部分；image-gen 可参照迁移。

### W5（次要）

- core `defaultLibrary`（`marketing/library.ts:391`）生产无调用方、无 reset 钩子——死状态。
- core 层 API key 群是进程级全局可变变量，多文档场景后写覆盖先写（单窗口生产无碍）。
- `fontDigestCache`/`tauriFontsCache` 等从不失效缓存：key 域有界不会爆内存，但运行期换字体文件后拿到旧值。
- `modelsPromise`（`provider-models.ts:25`）失败回落后整会话不再重试 OpenRouter 列表。

---

## 结论

分层架构本身没有问题，不需要架构调整。值得动手的是三个点，按性价比排序：

1. **W1**（聊天历史随设置变更丢失）——用户可感知的数据丢失，修复量小（迁移 WeakMap 即可）。
2. **W3**（chip 与文档脱节）——从 marker 回填即可，与已有 restore 路径同构。
3. **W2**（toolLog 无界增长）——长会话隐患，环形缓冲即可。

W4 随 D1 自然解决；W5 可记入 backlog 不急于处理。
