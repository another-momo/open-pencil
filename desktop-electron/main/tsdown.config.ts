import { join } from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { main: join(import.meta.dirname, 'main.ts') },
  platform: 'node',
  format: ['esm'],
  target: 'node20',
  outDir: join(import.meta.dirname, '..', 'dist-main'),
  clean: true,
  dts: false,
  sourcemap: false,
  external: ['electron', 'node:fs', 'node:http', 'node:crypto', 'node:path']
})
