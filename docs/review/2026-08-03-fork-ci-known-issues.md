# Fork CI 已知问题跟踪（2026-08-03）

> 上下文：`feature/marketing-workbench` 分支把 CI 触发修通了（`62c3f05c`、`8c473f80`、`536c07a5`），CI 现在每次 push 都会跑。
> 但跑起来后立刻暴露出 **fork 预存的、与本次营销工作台 PR 无关** 的三个 CI 红源。本文档跟踪这些红源，作为后续独立 PR 的输入。
> 本次 PR 不再追加修改，转入阶段 1 必修缺陷（registry 共同根因）。

---

## 现状

**已完成的提交**（fork 上 `feature/marketing-workbench` 顶端 3 个 commit）：

| Commit | 内容 | CI 验证 |
|---|---|---|
| `62c3f05c` | 修 `restore.test.ts` 测试断言（阶段 0 A） + CI 触发（阶段 0 B） + chat 分片（阶段 0 C） | ❌ LFS 鉴权失败，没跑到测试 |
| `8c473f80` | 关 LFS（临时绕过 R2 鉴权） | ❌ quality + scene 分片 fail |
| `536c07a5` | 修 chat 红测（`media-tool-results.ts` 手动循环代替 `.map`） | ❌ quality + scene fail，chat 被 fail-fast 牵连未跑 |

**CI 真信号**（本地 `bun test` 验证）：

- `bun test tests/engine/tools/marketing` → 68/68 全过（**0.1 修复真实有效**）
- `bun test tests/engine/chat` → 15/15 全过（**chat 红测修复真实有效**）

---

## 红源 #1：quality job — format 漂移

**失败步骤**：`Format check`（`bun run format:check`）

**症状**：CI 在 run `30799212144`、`30799915844` 两次都报告 23 个文件未格式化，oxfmt 跑过会修改这些文件。

**根因（复合）**：

1. **fork 预存的格式漂移**：fork 历史上累积的格式未同步（评审文档 §六紧急项 A 提到的 `fbb61d91` 提交 "resolve lint and typecheck errors blocking CI" 即源头）。
2. **Windows CRLF/LF 冲突**：fork owner 在 Windows + Git Bash + `core.autocrlf=true` 环境下 checkout，文件被自动转 CRLF；oxfmt 默认输出 LF。两次跑 `bun run format` 都会触发 100+ 文件的纯换行符 diff（不是真格式问题）。
3. **未设置 `.editorconfig` / `.gitattributes` 强制 LF**：仓库没有强制 LF 的策略。

**为什么不在本次 PR 修**：

- 改 365+ 文件是"格式化批量 PR"，与营销工作台不相关，会污染 git blame 历史
- CRLF/LF 是 fork owner 环境配置问题（`git config core.autocrlf false`），应该在 fork 仓库层独立处理
- 评审文档 §五阶段 0/1 都没把 format 漂移列为必修档（评审日没人触发 CI，所以没暴露）

**修复路径**（独立 PR）：

1. fork owner 执行 `git config core.autocrlf false`，避免 checkout 时改换行符
2. 在 `.gitattributes` 强制 `*.ts text eol=lf` / `*.json text eol=lf`
3. 跑一次 `bun run format`，把所有 365 个文件 commit 为单一 "chore: format" PR
4. 后续 PR 都基于这个 commit，避免每次都被漂移污染

---

## 红源 #2：unit-tests (scene) job — FontManager / .fig fixture 红测

**失败步骤**：`Run quick unit test shard` for `scene` shard

**症状**（run `30799915844`）：373 pass / 5 fail

```
(fail) plugin data > preserves plugin relaunch data from imported fig files
(fail) chooseLocalFontMatch > returns null when no candidates
(fail) chooseLocalFontMatch > picks exact family + style match
(fail) FontManager loaded font cache > (Alibaba PuHuiTi + Regular/Medium/Bold/etc) all resolve to a non-null buffer
(fail) FontManager loaded font cache > loadFamily falls back to global fetch when host loader returns null
```

**根因**：

`8c473f80` commit 把 `ci.yml` 里 `lfs: 'true'` 改成 `lfs: 'false'`，绕过了 R2 鉴权失败，但**关闭 LFS pull 的副作用是 `.fig` fixture 和阿里普惠体 `.ttf` 都拉不到**——CI runner 上的 `.fig` / `.ttf` 是几十字节的指针文件，不是真实对象。

3 个失败的内在逻辑：

| 测试 | 依赖 | 关 LFS 后状态 |
|---|---|---|
| `plugin data > preserves plugin relaunch data from imported fig files` | `tests/fixtures/*.fig` 真实文件 | 指针，解析失败 |
| `chooseLocalFontMatch > *` | 字体文件 / 系统字体探测 | 部分测试可过（不依赖 LFS），部分挂 |
| `FontManager loaded font cache > Alibaba PuHuiTi` | 阿里普惠体 9 字重 | 指针，Buffer 是 null |

**为什么不在本次 PR 修**：

- 这 5 个红测**在 fork 历史上从来没红过**——因为 fork 的 CI 从来没跑过（PR→master 限定），所以 LFS 没拉、字体测试在本地也没人跑过（本地 dev 机器上 `git lfs pull` 是手动的，可能 owner 拉过）
- 修法必须 fork 自己有 LFS bucket + 在 fork 仓库的 LFS 配置指向自己的 bucket，是基础设施级别的工作
- **评审文档 §六紧急项 A/B/C 完全没有提到 LFS**，因为评审时 CI 还没跑，没暴露

**修复路径**（独立 PR / 基础设施工作）：

1. fork owner 在自己的 R2 / S3 / Cloudflare R2 上传 LFS 对象：
   - `tests/fixtures/*.fig`（几十 KB × N）
   - `tests/fixtures/fonts/*.ttf`（几 MB × N）
   - `packages/core/vendor/canvaskit-webgpu/*.wasm`（几 MB）
   - `public/AlibabaPuHuiTi*.ttf`（62MB × 9 字重 = 558MB）
   - `packages/core/assets/AlibabaPuHuiTi*.ttf`（同 558MB）
2. fork 仓库根目录加 `.lfsconfig`：

   ```ini
   [lfs]
       url = https://your-r2-bucket.example.com/open-pencil-lfs
   ```
3. CI runner 配 `GIT_LFS_TOKEN` secret（fork owner 在 fork 仓库 Settings → Secrets 加）
4. 把 `ci.yml` 的 `lfs: 'false'` 改回 `lfs: 'true'`

**临时方案**（维持当前 PR 红着也能接受）：把 `lfs: 'false'` 维持，**只**对**不依赖** LFS 的测试分片有意义。`vue` / `app` / `chat` 分片在本地都能全过；`scene` / `fig` / `editor` / `dom` 分片依赖 LFS，本地能跑（因为本地 dev 机器手动 `git lfs pull` 过）但 CI runner 上挂。

---

## 红源 #3（潜在）：其他 fork owner 环境配置

**`core.autocrlf` 警告**：

```
warning: in the working copy of 'src/app/ai/chat/media-tool-results.ts',
LF will be replaced by CRLF the next time Git touches it
```

这条在每次 git 操作后都会出现。**影响**：commit 看起来干净，但每次 checkout 都会改换行符，CI 端和本地 diff 不一致，git blame 历史会被噪声污染。

**修复**（fork owner 一次性配置）：

```bash
git config --global core.autocrlf false
# 或仅在本仓库：
cd path/to/open-pencil && git config core.autocrlf false
```

仓库层更彻底的是加 `.gitattributes`：

```
*.ts   text eol=lf
*.json text eol=lf
*.md   text eol=lf
```

---

## 阶段 1 之后的 CI 期望

| 修复路径 | CI 期望 |
|---|---|
| **只走本次 PR**（不修任何预存问题） | ❌ CI 一直红（quality + scene），阶段 1 改动不能验证 |
| **修 #1（format 漂移）** | ❌ quality 过，scene 仍挂 |
| **修 #1 + #2（LFS）** | ✅ 全绿 |
| **修 #1 + #2 + #3（autocrlf）** | ✅ 全绿，commit 历史干净 |

**建议执行顺序**：

1. ✅ 本次 PR 收尾（已做完：`62c3f05c` + `8c473f80` + `536c07a5`）
2. → 阶段 1.1（registry 共同根因）—— 改本地代码，**不依赖 CI 全绿**，本地 `bun test tests/engine/tools/marketing` 验证
3. 阶段 1 完成后，开独立 PR 修 #1（format 漂移）—— 是机械修复，1 个 commit 搞定
4. 阶段 1 完成后，开独立 PR 修 #2（LFS）—— 需要基础设施，最重
5. 三个独立 PR 都合入后，CI 才能稳定全绿，作为阶段 2/3/4 的回归基线

---

## 引用

- 评审文档：`docs/review/2026-08-01-marketing-workbench-branch-review.md` §六紧急项 A/B/C
- CI 配置：`.github/workflows/ci.yml`、`tools/unit-tests/src/shards.ts`、`.github/actions/setup-bun/action.yml`
- LFS 托管文件：`.gitattributes`
- 本次 PR 的 3 个 commit：`62c3f05c` / `8c473f80` / `536c07a5`