# @open-pencil/core

SceneGraph-agnostic building blocks for OpenPencil: tool definitions,
constants, IO/format readers, layout, color, design-JSX, and the
Figma-API proxy shim. The editor, the agent backend, and downstream
consumers all reuse the same definitions from here.

This package is **pure** — no DOM, no `vue`, no `node:*`. If you find
yourself wanting to import a browser-only API, the API belongs in
`packages/vue` or `src/app/**` instead.

## What lives here

- `tools/` — `CORE_TOOLS` (the canonical tool list passed to AI SDK's
  `ToolLoopAgent`); tools are valibot-validated and dispatched through
  the same bridge whether the loop runs in-browser (Path B) or in
  `@open-pencil/agent` (Path A).
- `constants/` — `AIProviderID`, provider metadata, model catalogs.
- `io/` — `.fig`, `.pen`, image-byte decode/encode, format registry.
- `layout/` — autolayout, constraints, alignment math.
- `color/` — color space conversions (sRGB, DisplayP3) and serialization.
- `kiwi/` — TreeNode model that the `.fig` reader/writer walks.
- `figma-api/` — minimal Figma plugin API proxy (used by the canvas
  editor; CODELINE templates for migrating plugin code).
- `design-jsx/` — JSX runtime for the design-file DSL.

## Install / use

```sh
bun add @open-pencil/core
```

```ts
import { CORE_TOOLS } from '@open-pencil/core/tools'
import { AIProviderID } from '@open-pencil/core/constants'
```

`@open-pencil/agent` imports `CORE_TOOLS` directly so the editor and
the agent stay in sync on tool shapes — no parallel definitions.

## Benchmarks / line counts

Layout, color, and IO routines are deliberately allocation-light
because they're on the synchronous path of every render. See
`tests/` for parity benchmarks against the Figma reference impl.

## Design

See `docs/plans/architecture/l2-agent-backend.md` for how `core` sits
between the editor (`src/app/**`), the agent backend
(`packages/agent/`), and the MCP bridge (`packages/mcp/`).
