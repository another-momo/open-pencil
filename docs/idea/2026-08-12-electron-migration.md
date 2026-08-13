# Electron 迁移方案：抛弃 Tauri，只保留 Electron

> 状态：草案 / 待决策  
> 创建日期：2026-08-12  
> 背景：Tauri 版频繁卡死，多次优化未果，怀疑 WebView2 渲染层问题

---

## 一、问题

当前 open-pencil 的 Tauri 桌面版存在稳定性问题：
- Web dev 版运行正常，Tauri 版频繁卡死
- 已做过多次优化，仍未根本解决
- Tauri 的 WebView2 在各平台表现不一致
- 同时维护 Web + Tauri 两个版本带来大量条件分支（`IS_TAURI` 散落在 50+ 文件中）

## 二、目标

- 彻底去掉 Tauri，只保留 Electron 一个桌面版本
- 去掉 Web/PWA 多平台维护负担
- 精简非核心功能，降低维护复杂度
- 实现自托管字体库（版权管控）
- 改善 AI Agent 能力（对话持久化、上下文 compaction）
- **Marketing AI 模式是主产品，必须完整保留**

## 三、功能精简决策

### 3.1 必砍（平台相关）

| 功能 | 涉及目录 | 理由 |
|------|---------|------|
| Tauri Rust 后端 | `desktop/` | 被 Electron 替代 |
| Tauri 前端适配层 | `src/app/tauri/` | 被 `src/app/native/` 替代 |
| PWA 支持 | `vite-plugin-pwa`, `workbox-window` | 不需要浏览器版 |
| Safari 降级提示 | `src/components/SafariBanner.vue` | 不需要浏览器版 |
| 浏览器菜单栏 | `src/components/Shell/AppMenu.vue` 浏览器部分 | Electron 用原生菜单 |
| `IS_TAURI` / `IS_BROWSER` 条件分支 | 散落 50+ 文件 | 统一平台后消除 |
| Browser bridge | `src/app/browser-bridge.ts` | Electron 不需要 |
| Demo 模式 | `src/app/demo/` | 不需要在线演示 |

### 3.2 必砍（功能精简）

| 功能 | 涉及目录 | 理由 |
|------|---------|------|
| 实时协作 (P2P WebRTC) | `src/app/collab/` (8 文件) | 桌面工具不需要 |
| 图片矢量化 (Recraft / fal.ai) | `src/app/editor/vectorize/` (6 文件) | 依赖外部 API，非核心 |
| ACP (Claude Code/Codex 集成) | `src/app/ai/acp/` (4 文件) | 已决定去掉 |
| MCP Server 本地桥接 | `src/app/automation/` (13 文件) | 已决定去掉 |
| CLI 运行时连接 | `packages/cli/src/app-client.ts` | 已决定去掉 |

### 3.3 保留的核心功能

| 功能 | 涉及目录 | 重要性 |
|------|---------|--------|
| **Marketing AI 模式** | `src/app/ai/marketing/` (4 文件) + 3 个 UI 组件 | ⭐ 主产品 |
| **素材图库 (Pexels / Unsplash)** | AI 图片生成的素材来源 | ⭐ Marketing 依赖 |
| 编辑器核心 | `packages/core/`, `packages/scene-graph/` | 基础能力 |
| AI Chat (Vercel AI SDK) | `src/app/ai/chat/` | Marketing 的基础 |
| 文件 I/O (.fig / .pen) | `src/app/document/io/` | 基础能力 |
| Storybook | `.storybook/` + 7 个 `.stories.ts` | 开发工具，可选保留 |

### 3.4 精简后规模对比

| 维度 | 当前 | 精简后 |
|------|------|--------|
| `src/app/` 模块数 | ~15 个 | ~8 个 |
| 平台条件分支 | ~50 处 | 0 |
| 外部 API 依赖 | 5+ 个 | 2 个 (AI provider + 素材图库) |
| 代码量 | ~100% | ~65% |

## 四、Tauri 集成分析

### 4.1 Rust 后端 (`desktop/src/`)

| 模块 | 功能 | 依赖 crate |
|------|------|-----------|
| `credentials.rs` | 系统密钥链存取 | `keyring` |
| `fig_container.rs` | FIG 文件构建 (zstd+zip) | `zstd`, `zip` |
| `fonts.rs` | 系统字体枚举/加载 | `font-kit` |
| `http.rs` | HTTP 代理 (绕过 CORS) | `reqwest` |
| `menu.rs` | 原生菜单 | tauri menu API |
| `menu_events.rs` | 菜单事件 | tauri emitter |
| `window.rs` | macOS 窗口管理 | tauri window |

共 9 个 Tauri commands，约 1500 行 Rust 代码。

### 4.2 前端 Tauri 适配层 (`src/app/tauri/`)

- `env.ts` — `isTauri()` 运行时检测
- `http.ts` — `tauriFetch()` 代理请求
- `command.ts` — 平台命令解析
- `clipboard.ts` — 剪贴板读写

### 4.3 使用的 Tauri Plugins

clipboard-manager, dialog, fs(+watch), opener, process, shell, updater, single-instance

### 4.4 架构优势（有利于迁移）

1. Tauri 代码集中在 `src/app/tauri/`，其他模块通过 `IS_TAURI` 判断
2. 所有 Tauri API 都是动态 import（懒加载）
3. 浏览器 fallback 已存在（File System Access API、WebCrypto 等）

## 五、Electron 替代方案

### 5.1 功能对照

| Tauri 功能 | Electron 替代 | 难度 |
|-----------|--------------|------|
| 密钥链 (keyring) | `electron.safeStorage` | 低 — 内置 API |
| 系统字体枚举 | `fontkit` (纯 JS) | 低 — 无 native 编译 |
| HTTP 代理 (CORS) | `electron.net.request` | 低 — 天然无 CORS |
| FIG 文件构建 | `fflate` (已有) + `zstd-wasm` | 低 |
| 原生菜单 | `Menu.buildFromTemplate()` | 低 |
| 文件读写/watch | Node.js `fs` 模块 | 低 |
| 文件对话框 | `dialog.showOpenDialog()` | 低 |
| Shell 命令 | `child_process.spawn` | 低 |
| 单实例锁 | `app.requestSingleInstanceLock()` | 低 |
| 自动更新 | `electron-updater` | 低 |
| 剪贴板 | `clipboard` 模块 | 低 |

### 5.2 平台指标对比

| 维度 | Tauri v2 | Electron |
|------|----------|----------|
| 包体大小 | ~7 MB | ~150-200 MB |
| 内存占用 | ~80-150 MB | ~200-400 MB |
| 启动速度 | 快 | 较慢 |
| 稳定性 | WebView2 各平台不一致 | Chromium 内核统一 |
| 调试 | DevTools 需手动开启 | 内置 DevTools |
| 构建复杂度 | 需 Rust 工具链 | 仅 Node.js |
| IPC 性能 | 二进制 IPC，快 | JSON IPC，够用 |

## 六、字体管理：自托管字体库

### 6.1 目标

完全自己管理可用字体库，把控设计作品的字体版权。

### 6.2 技术方案

- **字体解析**: `fontkit`（纯 JS，OpenType/TrueType 全支持，比 Rust `font-kit` 有更丰富的 OpenType 表访问）
- **元数据存储**: SQLite（`better-sqlite3`）
- **字体文件**: 本地磁盘目录 + `@font-face` + `URL.createObjectURL()` 加载

### 6.3 目录结构

```
fonts/
├── licensed/           ← 已授权字体
│   ├── Inter/
│   │   ├── Inter-Regular.otf
│   │   ├── Inter-Bold.otf
│   │   └── meta.json   ← 版权信息、许可类型
│   └── ...
└── imported/           ← 新导入待分类
```

### 6.4 版权管控能力

- 解析 `OS/2` table 的 `fsType` 字段（embedding license flags）
- 标记 "Editable" / "Installable" / "Preview & Print" / "Restricted"
- 导出/保存时校验字体是否允许嵌入
- 作品元数据记录字体来源

### 6.5 参考项目

- [Fontastic](https://github.com/tomshaw/fontastic) — Electron 43 + fontkit + SQLite，最完整的参考
- [Char](https://ivantacca.com/project/char-themable-font-manager) — Electron 字体管理器

## 七、功能精简详细清单

### 7.1 可移除模块

| 功能 | 涉及目录 | 文件数 |
|------|---------|--------|
| ACP (Claude Code/Codex 集成) | `src/app/ai/acp/` | 4 |
| MCP Server 本地桥接 | `src/app/automation/` | 13 |
| CLI 运行时连接 | `packages/cli/src/app-client.ts` | 1 |
| 实时协作 (P2P WebRTC + Yjs) | `src/app/collab/` | 8 |
| 图片矢量化 (Recraft / fal.ai) | `src/app/editor/vectorize/` | 6 |
| Demo 模式 | `src/app/demo/` | ~10 |
| Browser bridge | `src/app/browser-bridge.ts` | 1 |

### 7.2 简化后的 Electron IPC

```typescript
// 只需 5 个 handlers（原 9 个）
- list_system_fonts    // 字体枚举
- load_system_font     // 字体加载
- build_fig_file       // FIG 文件构建
- credential_*         // 密钥链（3 合 1）
- file_system          // 文件读写/监控
```

### 7.3 精简后保留的完整功能列表

| 功能模块 | 说明 | 依赖 |
|---------|------|------|
| Marketing AI 模式 | 主产品：AI 生成营销素材 | Vercel AI SDK |
| AI Chat | 对话式设计助手 | Vercel AI SDK |
| 素材图库 | Pexels / Unsplash 图片搜索 | 外部 API (保留) |
| 编辑器核心 | 场景图、渲染、工具、布局 | 无外部依赖 |
| 文件 I/O | .fig / .pen 打开保存 | 无外部依赖 |
| 组件/实例系统 | 设计组件复用 | 无外部依赖 |
| 撤销/重做 | 编辑历史 | 无外部依赖 |
| 导出 | PNG/JPG/SVG/FIG | 无外部依赖 |
| 自托管字体库 | 字体管理 + 版权管控 | fontkit + SQLite (新增) |
| 对话持久化 | 跨会话保存聊天记录 | SQLite (新增) |
| Storybook | 组件开发预览工具 | 开发依赖 (可选保留) |

## 八、AI Agent 能力改善

### 8.1 当前问题

- 对话记录：内存 `WeakMap`，tab 关闭即丢失
- 上下文管理：仅图片裁剪（`elideMediaToolResults`），无 compaction
- Token 用量：无跨会话统计

### 8.2 Electron 下的改善方案

| 功能 | 方案 |
|------|------|
| 对话持久化 | SQLite 存储，按文档关联 |
| Context compaction | 超过 token 阈值时调 LLM 生成摘要压缩 |
| Token 用量追踪 | 持久化到数据库，跨会话统计 |
| 对话导出 | JSON / Markdown |

### 8.3 架构示意

```typescript
// electron/main/services/chat-store.ts
class ChatStore {
  saveThread(documentId: string, messages: UIMessage[])
  loadThread(documentId: string): UIMessage[]
  async compactThread(documentId: string) // 自动摘要压缩
  recordUsage(documentId: string, usage: UsageRecord)
}
```

> 注：对话持久化与 Electron/Tauri 无关，是应用层逻辑。但 Electron 的 `better-sqlite3` 原生模块无需 Rust 编译，实现更顺手。

## 九、对合并上游的影响

### 9.1 上游变更分类

| 类别 | 合并难度 |
|------|---------|
| 核心业务逻辑 (`packages/`) | ✅ 低 — 与平台无关 |
| 前端 Tauri 适配 (`src/app/tauri/`) | ⚠️ 中 — 需同步改 Electron |
| Rust 后端 (`desktop/src/`) | ❌ 完全冲突 |

### 9.2 推荐策略

- 不再合并上游，独立演进
- 核心价值在 `packages/core/`、`packages/scene-graph/`、编辑器逻辑 — 跟平台无关
- 上游的 Tauri 功能增长慢，且你全部重写，等它改完没意义
- 关注上游 release notes，手动移植有价值的 bug fix

## 十、渐进式迁移路线

### 阶段 1：搭骨架（3-5 天）

- 创建 `electron/` 目录，实现主进程
- 5 个 IPC handlers 替代 Tauri commands
- Electron 加载 Vite dev server（`http://localhost:1420`）
- 验证：启动、打开文件、渲染正常

### 阶段 2：去条件分支（2-3 天）

- 去掉所有 `IS_TAURI` / `IS_BROWSER` 条件分支
- 删除 browser fallback 代码
- 将 `src/app/tauri/` 重构成 `src/app/native/`

### 阶段 3：补能力（3-5 天）

- 自托管字体库（fontkit + SQLite）
- 对话持久化
- Electron 菜单

### 阶段 4：独立演进

- 与上游脱钩
- 只在有有价值的 bug fix 时手动移植 `packages/` 改动

## 十一、测试方案

Playwright 原生支持 Electron（`_electron.launch()`），测试完全一样：

```typescript
import { _electron as electron } from '@playwright/test'

test('renders a rectangle', async ({}) => {
  const app = await electron.launch({ args: ['.'] })
  const page = await app.firstWindow()
  await page.getByRole('button', { name: 'Rectangle' }).click()
  await expect(page).toHaveScreenshot('rectangle.png')
  await app.close()
})
```

开发时 `bun run dev` 启动 Vite，Electron 加载 localhost — 热更新体验不变。

## 十二、风险与决策点

| 问题 | 建议 |
|------|------|
| 上游还在快速迭代，是否该等？ | 不用等。迁移的是平台层，核心逻辑照样能移植 |
| 包体从 7MB 膨胀到 150MB+ | 设计工具用户可接受，优先保证稳定性 |
| `keytar` 原生模块编译问题 | 用 `electron.safeStorage` 替代，无需原生模块 |
| 上游合并成本 | 接受有限合并，独立演进 |
| 团队学习成本 | Electron 生态比 Tauri 更成熟，资料更多 |

---

*此文档为草案，待决策后更新实施细节。*
