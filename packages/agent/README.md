# @open-pencil/agent

Local Node service that hosts the AI agent loop for OpenPencil. The web
frontend sends chat requests via HTTP/SSE; tool execution is dispatched
back to the editor via the existing WebSocket automation bridge.

This package is part of the "local CLI backend + localhost web UI" form
factor — distinct from the desktop (Tauri), pure-frontend (PWA), headless
CLI, and standalone MCP server shapes.

## Installation

```sh
bun add @open-pencil/agent
```

Peer dependencies (workspace-provided):

- `@open-pencil/core` — tool definitions, SceneGraph-agnostic
- `@hono/node-server`, `hono` — HTTP server
- `ws` — WebSocket client (reverse-RPC into the frontend mcp server)
- `@ai-sdk/*` provider packages — Anthropic, OpenAI, Google, DeepSeek, OpenRouter
- `valibot`, `@ai-sdk/valibot` — tool schema validation

## Usage

Start the agent in a separate process while the OpenPencil editor is running:

```sh
# from the workspace root, after building:
bun --filter @open-pencil/agent build
node packages/agent/dist/start.mjs

# or run via the bin entry (after build):
openpencil-agent
```

The server listens on `http://127.0.0.1:7601` by default. Override with
`OPENPENCIL_AGENT_PORT`. Host defaults to `127.0.0.1` (loopback only);
override with `OPENPENCIL_AGENT_HOST` for advanced setups.

The frontend probes `/health` on the configured port; if the agent is
reachable, chat sessions go through the agent backend (Path A in
`src/app/ai/chat/transports.ts`). When the agent is not running, the
frontend falls back to running the same agent loop in-browser (Path B).

A discovery file is written at startup so the frontend knows where to find
us:

| Platform | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\OpenPencil\agent.json` |
| macOS | `~/Library/Application Support/OpenPencil/agent.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/agent.json` (or `~/.local/share/openpencil/agent.json`) |

## Package-local checks

```sh
cd packages/agent
bun run check
```

Package scripts:

- `bun run test` — Bun unit tests for credentials, routes, bridge, SSE parse
- `bun run typecheck` — type-checks `src` and tests
- `bun run build` — builds the distributable `dist` entrypoints
- `bun run check` — runs typecheck + tests + build

Tests live in `tests/engine/agent/*.test.ts` (workspace test convention).
The chat shard (`tools/unit-tests/src/shards.ts`) picks them up.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `OPENPENCIL_AGENT_PORT` | `7601` | HTTP port for `/health`, `/v1/auth`, `/v1/chat`, `/v1/catalog` |
| `OPENPENCIL_AGENT_HOST` | `127.0.0.1` | Bind address (loopback by default) |
| `OPENPENCIL_AGENT_VERSION` | package version | Override the version reported in `/health` |
| `OPENPENCIL_AGENT_CORS_ORIGINS` | `http://localhost:1420,http://127.0.0.1:1420` | Comma-separated CORS allow-list. Set to `none` (or empty) to lock down to same-origin only. |
| `OPENPENCIL_AGENT_DISABLE` (frontend) | — | When set to `1` in the frontend `.env.local`, the frontend skips the `/health` probe and always falls back to Path B |

API keys are **not** read from env. The frontend POSTs them to `/v1/auth`
per chat session; the agent holds them in a 1-hour in-memory TTL. See
`docs/plans/architecture/l2-agent-backend.md` §3.2 for the wire shape and
P1 plans for OS keychain migration.

## Protocol

### `POST /v1/chat`

Streams `ToolLoopAgent` output as AI SDK UIMessage chunks over SSE.

Request headers: `x-op-connection-id`, `x-op-chat-id`.

Request body:

```ts
{
  id: string                      // mirrors x-op-chat-id
  messages: ModelMessage[]        // UI→Model converted by the frontend transport
  trigger: 'submit-message' | 'regenerate-message'
  agent: {
    connectionId, providerID, modelID,
    customModelID, customBaseURL, customAPIType,
    maxOutputTokens, chatMode, lookImagesKept
  }
  librarySnapshot?: { /* marketing-mode library state, see library-snapshot.ts */ }
}
```

Response: `text/event-stream`, `x-vercel-ai-data-stream: v1`.

### `POST /v1/auth` / `DELETE /v1/auth/:connectionId`

Publishes / forgets the per-connection API key. The frontend pushes on
every chat-open; the agent holds it for 1h.

### WebSocket reverse-RPC

The agent connects to the frontend's mcp server (port 7600 / Unix socket,
see `packages/mcp`), sends `{type:'auth', token}` (NOT `register` — that
would steal the browser's RPC slot), then issues
`{type:'request', id, command:'tool', args}` envelopes and awaits
`{type:'response', id, ok, result}`.

RPC timeout: 300 s (covers the 240 s image-generation provider timeout
plus image-byte transfer margin).

## Public subpaths

- `@open-pencil/agent` — entry point; runtime exports the start script
- `bin/openpencil-agent` — built CLI entry (`dist/start.mjs`)

Internal modules are not exported as public subpaths; consumers go through
the running HTTP/WS interface, not the TypeScript source.

## Troubleshooting

**"Agent backend is not running. Start `bun run dev` (or `bun run tauri dev`) before chatting through the agent backend."**

The frontend probed `/health` and got no response. Either the agent
process is not running or it crashed. Check the agent logs (stdout /
stderr) and confirm `127.0.0.1:7601/health` responds:

```sh
curl http://127.0.0.1:7601/health
# {"status":"ok","version":"0.14.0","activeConnections":0}
```

**"API key not available — POST /v1/auth first"**

The frontend sent a chat request without pushing credentials. This
usually means the API key is missing in Settings → AI Provider. The
frontend should auto-push on every chat open; if you see this error,
check the browser console for a CORS or network error on
`POST /v1/auth`.

**"RPC timeout (300s)"**

A tool execution exceeded the 5-minute envelope. Image generation can
hit 240 s legitimately — if you see this in normal use, raise
`BRIDGE_RPC_TIMEOUT_MS` in `src/bridge/ws-client.ts` and the matching
`RPC_TIMEOUT` in `packages/mcp/src/browser-rpc.ts`. If you see it on a
short-running tool (read, write_text), the frontend mcp server may have
crashed; restart `bun run dev`.

**Browser console: CORS error on `127.0.0.1:7601`**

The dev server is running on a port other than 1420. Either:
- Start Vite on 1420 (the default), or
- Add the port to `OPENPENCIL_AGENT_CORS_ORIGINS` (comma-separated), or
- Set `OPENPENCIL_AGENT_CORS_ORIGINS=none` if you intentionally want to
  block all browser access (e.g. for production behind a reverse proxy).

## Design

See `docs/plans/architecture/l2-agent-backend.md` for the full protocol,
lifecycle, invariants, and trade-offs.

`@open-pencil/agent` must not import `src/app/**` (frontend Vue code) or
`#vue/*` directly — agent operates on serialized snapshots, never on
the editor's live SceneGraph.
