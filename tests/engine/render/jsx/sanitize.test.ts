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

  it('keeps a self-closing last child inside a same-named parent (regression)', async () => {
    // The recovery regex is nesting-blind: it must NOT eat the parent's
    // closing tag here. This is the exact shape that produced
    // "Unexpected token" hard failures in production logs.
    const g = makeSceneGraph()
    const results = await renderJSX(
      g,
      '<Frame name="GiftRow" w="fill" h={260} flex="row" justify="center" gap={20}><Frame name="GiftBox1" w={280} h={260} rounded={12} bg="#E2E8F0" /><Frame name="GiftBox2" w={280} h={260} rounded={12} bg="#E2E8F0" /></Frame>'
    )
    expect(results[0].name).toBe('GiftRow')
    expect(results[0].childIds.length).toBe(2)
  })

  it('keeps a self-closing child followed by parent close and further siblings (regression)', async () => {
    const g = makeSceneGraph()
    const results = await renderJSX(
      g,
      '<Frame name="GiftSection" w="fill" h={480} flex="col"><Frame w="fill" flex="row" gap={20}><Frame name="B1" w={280} h={260} bg="#E2E8F0" /><Frame name="B2" w={280} h={260} bg="#E2E8F0" /></Frame><Text size={16}>note</Text></Frame>'
    )
    expect(results[0].name).toBe('GiftSection')
    expect(results[0].childIds.length).toBe(2)
  })
})
