import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  entry: {
    index: './src/index.ts',
    start: './src/start.ts',
    server: './src/server.ts',
    'agent-loop': './src/agent-loop.ts',
    'tools-bridge': './src/tools-bridge.ts',
    'prompts/index': './src/prompts/index.ts',
    'prompts/library-snapshot': './src/prompts/library-snapshot.ts',
    catalog: './src/catalog.ts',
    credentials: './src/credentials.ts',
    elision: './src/elision.ts',
    'media-rewriter': './src/media-rewriter.ts',
    'model-resolver': './src/model-resolver.ts',
    'provider-helpers': './src/provider-helpers.ts',
    'providers/registry': './src/providers/registry.ts',
    'providers/compatible': './src/providers/compatible.ts',
    'providers/types': './src/providers/types.ts',
    constants: './src/constants.ts',
    discovery: './src/discovery.ts',
    'bridge/ws-client': './src/bridge/ws-client.ts'
  },
  platform: 'node',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    neverBundle: [
      '@ai-sdk/anthropic',
      '@ai-sdk/deepseek',
      '@ai-sdk/google',
      '@ai-sdk/openai',
      '@ai-sdk/valibot',
      '@hono/node-server',
      '@open-pencil/core',
      /^@open-pencil\/core\//,
      '@openrouter/ai-sdk-provider',
      'ai',
      'hono',
      /^hono\//,
      'valibot',
      'ws',
      /^node:/
    ],
    onlyBundle: false
  },
  hooks: {
    'build:done': async () => {
      // Copy package.json so start.mjs can resolve its version at runtime.
      copyFileSync(resolve(here, 'package.json'), resolve(here, 'dist', 'package.json'))
    }
  }
})