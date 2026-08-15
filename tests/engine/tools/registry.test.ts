import { describe, expect, test } from 'bun:test'

import { CORE_TOOLS } from '@open-pencil/core'

import { ALL_TOOLS } from '#tests/helpers/tools'

describe('tool definitions', () => {
  test('all tools have unique names', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('all tools have description and params', () => {
    for (const t of ALL_TOOLS) {
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(typeof t.params).toBe('object')
      expect(typeof t.execute).toBe('function')
    }
  })

  test('required params are marked', () => {
    for (const t of ALL_TOOLS) {
      for (const param of Object.values(t.params)) {
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
      }
    }
  })

  test('CORE_TOOLS exposes the full modify stack and common structure ops', () => {
    const coreNames = new Set(CORE_TOOLS.map((t) => t.name))
    const expected = [
      'update_node',
      'set_layout',
      'set_layout_child',
      'set_radius',
      'set_fill',
      'set_image_fill',
      'set_stroke',
      'set_stroke_align',
      'set_effects',
      'set_opacity',
      'set_visible',
      'set_rotation',
      'set_blend',
      'set_locked',
      'set_constraints',
      'set_minmax',
      'set_text',
      'set_text_properties',
      'set_text_resize',
      'set_font',
      'set_font_range',
      'clone_node',
      'rename_node',
      'group_nodes',
      'ungroup_node'
    ]
    for (const name of expected) {
      expect(coreNames.has(name), `${name} missing from CORE_TOOLS`).toBe(true)
    }
  })

  test('CORE_TOOLS and EXTENDED_TOOLS do not overlap', () => {
    const coreNames = new Set(CORE_TOOLS.map((t) => t.name))
    const allNames = ALL_TOOLS.map((t) => t.name)
    expect(new Set(allNames).size).toBe(allNames.length)
    for (const name of coreNames) {
      expect(allNames.filter((n) => n === name)).toHaveLength(1)
    }
  })
})
