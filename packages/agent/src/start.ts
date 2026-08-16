#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { startServer } from './server.js'

// Resolve version from the bundled package.json (sibling of dist/start.mjs).
const here = dirname(fileURLToPath(import.meta.url))
try {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8')) as {
    version?: string
  }
  if (pkg.version) process.env.OPENPENCIL_AGENT_VERSION = pkg.version
} catch {
  // Dist may run from a different layout; fall back to env var.
}

await startServer()