import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ALL_TOOLS, CORE_TOOLS, SCENE_PROP_MAP } from '@open-pencil/core'

/**
 * Drift watchdog for tool contracts (docs/plans/tasks/tool-system-optimization.md T9).
 *
 * (a) snake_case tokens in a tool description that name capabilities must be
 *     real params of that tool, or be explicitly allowlisted below (e.g. the
 *     batch_update NOT-supported list names props it deliberately rejects).
 * (b) batch_update's description supported-prop list is generated from
 *     SCENE_PROP_MAP and must equal it.
 * (c) prompt files may only reference tools the built-in agent actually has
 *     (CORE_TOOLS) — mentioning extended-only tools sends the agent to a
 *     tool-not-found dead end (precedent: marketing.md -> set_effects).
 */

const REPO_ROOT = resolve(import.meta.dir, '../../..')

const PROMPT_FILES = [
  'src/app/ai/chat/system-prompt-base.md',
  'src/app/ai/chat/system-prompt-marketing.md'
]

/**
 * (a) allowlist: description tokens that are intentionally not params —
 * cross-tool references and deliberate NOT-supported callouts. Add an entry
 * with a comment when a mention is deliberate; never to silence a real gap.
 */
const DESCRIPTION_MENTION_ALLOWLIST: Record<string, string[]> = {
  // NOT-supported list names props rejected by design; alternatives named.
  batch_update: [
    'font_size',
    'text',
    'fills',
    'effects',
    'rotation',
    'blend_mode',
    'letter_spacing',
    'line_height',
    'text_case',
    'update_node',
    'set_fill',
    'set_effects',
    'set_rotation',
    'set_blend'
  ],
  // Technical-constraint section names sync-API facts and preferred tools.
  eval: ['getNodeByIdAsync', 'loadFontAsync', 'batch_update', 'set_fill', 'replace_id'],
  // Guidance pointers to preferred tools (overlap annotations).
  set_opacity: ['update_node', 'batch_update'],
  set_visible: ['update_node', 'batch_update'],
  set_font: ['update_node', 'batch_update'],
  set_text_resize: ['set_text_properties', 'batch_update', 'auto_resize'],
  rename_node: ['update_node'],
  // JSON-array tool: description documents per-item fields of the `requests`
  // JSON string (verified against image-gen/requests.ts), not top-level params.
  generate_image: ['output_format', 'output_compression', 'replace_id'],
  // Workflow cross-references (tool-chain guidance, verified deliberate).
  read_brief: ['create_brief', 'find_nodes'],
  create_brief: ['read_brief'],
  compose_backdrop: ['generate_image', 'compose_backdrop'],
  // prepare_hero_scaffold names compose_backdrop's JSON fields in its recipe.
  prepare_hero_scaffold: [
    'generate_image',
    'replace_id',
    'compose_backdrop',
    'canvas_width',
    'hero_image_from'
  ],
  derive_palette: ['sample_hero_color'],
  get_page_tree: ['get_node'],
  list_available_fonts: ['list_fonts'],
  create_shape: ['create_vector'],
  insert_icon: ['fetch_icons'],
  fetch_icons: ['insert_icon']
}

/**
 * (c) allowlist: extended-only tool names a prompt may mention anyway —
 * only for prohibition phrasing ("never use X"). Keyed by prompt file.
 */
const PROMPT_MENTION_ALLOWLIST: Record<string, string[]> = {}

function snakeCaseTokens(text: string): Set<string> {
  const tokens = new Set<string>()
  for (const match of text.matchAll(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g)) {
    tokens.add(match[0])
  }
  return tokens
}

describe('tool description consistency', () => {
  test('(a) capability tokens in descriptions are real params or allowlisted', () => {
    for (const tool of ALL_TOOLS) {
      const params = new Set(Object.keys(tool.params))
      const allowed = new Set(DESCRIPTION_MENTION_ALLOWLIST[tool.name])
      // batch_update's description lists its props whitelist — those names
      // come from SCENE_PROP_MAP (single source), not from its params.
      if (tool.name === 'batch_update') {
        for (const key of Object.keys(SCENE_PROP_MAP)) allowed.add(key)
      }
      const offenders = [...snakeCaseTokens(tool.description)].filter(
        (token) => !params.has(token) && !allowed.has(token)
      )
      expect(offenders, `${tool.name} mentions non-params: ${offenders.join(', ')}`).toEqual([])
    }
  })

  test('(b) batch_update description supported list equals SCENE_PROP_MAP keys', () => {
    const tool = ALL_TOOLS.find((t) => t.name === 'batch_update')
    expect(tool).toBeDefined()
    const segment = tool?.description.split('props can include: ')[1]?.split('. ')[0]
    expect(segment).toBeDefined()
    const listed = segment?.split(', ').sort()
    expect(listed).toEqual(Object.keys(SCENE_PROP_MAP).sort())
  })

  test('(c) prompt files only reference CORE_TOOLS', () => {
    const coreNames = new Set(CORE_TOOLS.map((t) => t.name))
    for (const file of PROMPT_FILES) {
      const text = readFileSync(resolve(REPO_ROOT, file), 'utf8')
      const allowed = new Set(PROMPT_MENTION_ALLOWLIST[file])
      const offenders = ALL_TOOLS.filter(
        (tool) =>
          !coreNames.has(tool.name) &&
          !allowed.has(tool.name) &&
          new RegExp(`\\b${tool.name}\\b`).test(text)
      ).map((tool) => tool.name)
      expect(offenders, `${file} references non-core tools: ${offenders.join(', ')}`).toEqual([])
    }
  })
})
