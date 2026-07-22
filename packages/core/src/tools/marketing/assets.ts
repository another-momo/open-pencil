/**
 * Asset registry for marketing component templates.
 *
 * Templates reference assets by id (`imageRef`) instead of inlining bytes.
 * The registry resolves ids to image bytes at materialization time.
 * Built-in defaults ship with the code; a future brand kit can override
 * them without touching templates.
 */

const assets = new Map<string, Uint8Array>()

export function registerAsset(id: string, bytes: Uint8Array): void {
  assets.set(id, bytes)
}

export function getAsset(id: string): Uint8Array | undefined {
  return assets.get(id)
}

/** 32x32 solid brand-orange placeholder logo */
const DEFAULT_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGP4n21KU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAEIbfFsPVWtxAAAAAElFTkSuQmCC'

registerAsset('brand-logo', Uint8Array.fromBase64(DEFAULT_LOGO_BASE64))
