/**
 * Pre-build step: inline the three system-prompt markdown files into a
 * generated .ts module so they ship inside the bundle without needing
 * extra filesystem reads at runtime. tsdown is invoked after this runs.
 *
 * Triggered from package.json via `bun run build:prompts`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const promptsDir = join(__dirname, '..', 'src', 'prompts')
const outDir = join(promptsDir, 'generated')
mkdirSync(outDir, { recursive: true })

function escape(content: string): string {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
}

const files = [
  ['system-prompt.md', 'SYSTEM_PROMPT_DESIGN'],
  ['system-prompt-marketing.md', 'SYSTEM_PROMPT_MARKETING'],
  ['system-prompt-base.md', 'SYSTEM_PROMPT_BASE']
]

const exports: string[] = []
for (const [filename, exportName] of files) {
  const text = readFileSync(join(promptsDir, filename), 'utf-8')
  exports.push(`export const ${exportName} = \`${escape(text)}\``)
}

const output = '// AUTO-GENERATED — do not edit. See scripts/inline-prompts.ts.\n' + exports.join('\n')
writeFileSync(join(outDir, 'prompts.ts'), output)
console.log(`[agent] inlined ${files.length} prompt files to ${outDir}`)