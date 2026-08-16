# @open-pencil/mcp

Local WebSocket + HTTP server that bridges the OpenPencil editor to
external automation clients — including the `@open-pencil/agent` package
(Path A chat backend) and direct browser users of the editor.

## What it does

The MCP server hosts two complementary surfaces:

1. **WebSocket reverse-RPC** (`packages/mcp/src/browser-rpc.ts`) — the
   OpenPencil editor window connects on startup; each connection
   owns a slot for clients sending `tool` RPCs into the editor.
2. **HTTP + MCP** (`packages/mcp/src/server.ts`) — exposes the same
   tool surface to other clients (mcp-compatible LLMs, the agent
   backend, browser fronts) over HTTP/WebSocket.

Because the editor itself holds the SceneGraph, all tool execution
ultimately runs in the browser tab. The server is a transport and
authentication layer, not a tool executor.

## Install / run

```sh
bun add @open-pencil/mcp
bunx openpencil-mcp-http
```

Default port: `7600` (HTTP + WebSocket). Set `PORT=0` to disable TCP
and use a Unix domain socket instead (macOS / Linux only).

The server writes a discovery file at startup so the frontend and
agent can find it:

| Platform | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\OpenPencil\mcp.json` |
| macOS | `~/Library/Application Support/OpenPencil/mcp.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/mcp.json` (or `~/.local/share/openpencil/mcp.json`) |

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `7600` | HTTP/WS port. Set `0` to disable TCP (Unix socket only). |
| `OPENPENCIL_MCP_SOCKET` | platform path | Override Unix socket path (recorded in the discovery file). |
| `OPENPENCIL_MCP_DISCOVERY_PATH` | platform path | Override discovery file location; parent dir created 0o700. Mainly for test isolation. |
| `OPENPENCIL_MCP_AUTH_TOKEN` | auto-generate | Bearer token. Empty string → disable auth. Auto-generated if unset. |
| `OPENPENCIL_MCP_ROOT` | `cwd` | Allowed directory for file-scoped tools. |
| `OPENPENCIL_MCP_EVAL` | `0` | Set to `1` to enable the `eval` tool. |
| `OPENPENCIL_MCP_CORS_ORIGIN` | — | Allowed CORS origin. |
| `OPENPENCIL_MCP_APP_TIMEOUT_MS` | unset | Close the server after this many ms with no app attached. Unset/0 disables. |

## Wire shape

Browser ↔ server uses an `RpcEnvelope` (`packages/mcp/src/rpc-types.ts`):

```ts
type RpcEnvelope =
  | { type: 'register'; tabId: string; authToken: string }   // from the editor
  | { type: 'auth'; token: string }                          // from external clients (e.g. agent)
  | { type: 'request'; id: string; command: string; args: unknown }
  | { type: 'response'; id: string; ok: boolean; result?: unknown; error?: string }
  | { type: 'abort'; id: string }                            // caller cancels in-flight RPC
```

External clients (the agent backend, in particular) `auth` first, then
issue `request` envelopes. The `'abort'` branch is supported by the
agent bridge so user-initiated chat cancels propagate all the way to
the in-browser tool handler.

## Public subpaths

- `@open-pencil/mcp` — entry point; runtime exports the start script
- `bin/openpencil-mcp-http` — built CLI entry

Internal modules are not exported as public subpaths; consumers go
through the running HTTP/WS interface, not the TypeScript source.

## Design

See `docs/plans/architecture/l2-agent-backend.md` for the full
protocol, lifecycle, and security model.
