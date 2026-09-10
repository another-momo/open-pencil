import type { StockPhotoProvider } from '#core/tools/stock-photo/providers'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
export const PHOTO_URL = `data:image/png;base64,${PNG_BYTES.toBase64()}`

export interface ProviderCall {
  query: string
  options: {
    perPage: number
    orientation: 'landscape' | 'portrait' | 'square'
    targetDim: number
  }
}

export function createProvider(calls: ProviderCall[]): StockPhotoProvider {
  return {
    name: 'test',
    async search(query, options) {
      calls.push({ query, options })
      return [
        {
          url: PHOTO_URL,
          width: 1600,
          height: 900,
          photographer: 'Test Photographer',
          sourceId: 'photo-1'
        }
      ]
    }
  }
}
