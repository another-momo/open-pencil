import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { makeSceneGraph } from '#tests/helpers/scene'

describe('renderJSX model-slip tolerance', () => {
  it('renders a self-closing tag trailed by its own closing tag', async () => {
    const g = makeSceneGraph()
    const results = await renderJSX(g, '<Frame name="Hero" w={100} h={50} bg="#EEEEEE"/></Frame>')
    expect(results[0].name).toBe('Hero')
    expect(results[0].type).toBe('FRAME')
  })

  it('repairs nested self-close-plus-close slips', async () => {
    const g = makeSceneGraph()
    const results = await renderJSX(
      g,
      '<Frame name="A" w={100} h={50}><Rectangle w={10} h={10}/></Rectangle><Text size={12}>hi</Text></Frame>'
    )
    expect(results[0].childIds.length).toBe(2)
  })

  it('strips literal </jsx> wrappers', async () => {
    const g = makeSceneGraph()
    const results = await renderJSX(g, '<Frame name="B" w={100} h={50}/></jsx>')
    expect(results[0].name).toBe('B')
  })

  it('still reports genuinely invalid JSX', async () => {
    const g = makeSceneGraph()
    await expect(renderJSX(g, '<Frame w={100}')).rejects.toThrow()
  })
})
