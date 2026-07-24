import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { FigmaDerivedTextGlyph } from '@open-pencil/scene-graph'

export function convertFigmaDerivedTextGlyphs(
  derivedTextData: NodeChange['derivedTextData'],
  blobs: Uint8Array[]
): FigmaDerivedTextGlyph[] {
  return (derivedTextData?.glyphs ?? [])
    .map((glyph) => {
      if (glyph.commandsBlob === undefined) return null
      const commandsBlob = blobs.at(glyph.commandsBlob)
      if (!commandsBlob) return null
      return {
        commandsBlob,
        x: glyph.position.x,
        y: glyph.position.y,
        fontSize: glyph.fontSize
      }
    })
    .filter((glyph): glyph is NonNullable<typeof glyph> => !!glyph)
}
