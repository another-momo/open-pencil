import { normalizePath, type ServerOptions } from 'vite'

const WATCHED_MARKDOWN_ROOTS = ['/src/', '/packages/core/src/', '/packages/vue/src/']

function ignoreMarkdownOutsideSource(path: string): boolean {
  const normalized = normalizePath(path)
  if (!normalized.endsWith('.md')) return false
  return !WATCHED_MARKDOWN_ROOTS.some((root) => normalized.includes(root))
}

export const WATCH_IGNORED = [
  '**/desktop/**',
  '**/packages/cli/**',
  '**/packages/mcp/**',
  '**/packages/docs/**',
  '**/tests/**',
  '**/.worktrees/**',
  '**/.github/**',
  '**/.pi/**',
  ignoreMarkdownOutsideSource
]

export function createDevServerOptions(host: string | undefined): ServerOptions {
  return {
    port: 1420,
    strictPort: true,
    host: host || false,
    proxy: {
      // Dev-only CORS bypass for the MiniMax Anthropic-compatible endpoint
      // (its preflight does not allow the anthropic-version header from
      // browser origins; Tauri uses tauriFetch and never needs this).
      // Settings baseURL: http://localhost:1420/proxy/minimax-anthropic
      '/proxy/minimax-anthropic': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/minimax-anthropic/, '/anthropic/v1')
      }
    },
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: WATCH_IGNORED
    }
  }
}
