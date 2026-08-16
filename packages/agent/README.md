# @open-pencil/agent

Local Node service that hosts the AI agent loop for OpenPencil. The web
frontend sends chat requests via HTTP/SSE; tool execution is dispatched
back to the editor via the existing WebSocket automation bridge.

This package is part of the "local CLI backend + localhost web UI" form
factor — distinct from the desktop (Tauri), pure-frontend (PWA), headless
CLI, and standalone MCP server shapes.

## Usage

```sh
bun packages/agent        # from the workspace root
# or after build:
openpencil-agent
```

The server listens on `http://127.0.0.1:7601` by default. Override with
`OPENPENCIL_AGENT_PORT`.

A discovery file is written to the platform-specific OpenPencil config
directory (`%LOCALAPPDATA%\OpenPencil\agent.json` on Windows,
`~/Library/Application Support/OpenPencil/agent.json` on macOS,
`$XDG_RUNTIME_DIR/openpencil/agent.json` on Linux).