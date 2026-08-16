import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

const MODELS_DEV_URL = 'https://models.dev/api.json'
const MODELS_DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const PROVIDER_KEYS: Partial<Record<AIProviderID, readonly string[]>> = {
  openrouter: ['openrouter'],
  anthropic: ['anthropic'],
  openai: ['openai'],
  google: ['google'],
  deepseek: ['deepseek'],
  zai: ['zhipuai'],
  'zai-cn': ['zhipuai'],
  minimax: ['minimax'],
  'minimax-cn': ['minimax']
}

type ModelsDevModel = {
  id?: unknown
  name?: unknown
  attachment?: unknown
  tool_call?: unknown
  limit?: { output?: unknown }
}

type ModelsDevProvider = {
  models?: Record<string, ModelsDevModel>
}

type ModelsDevCatalog = Record<string, ModelsDevProvider>

function cacheDir(): string {
  const override = process.env.OPENPENCIL_AGENT_CACHE_DIR?.trim()
  if (override) return override
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Caches', 'OpenPencil')
  if (platform() === 'win32') {
    const local = process.env.LOCALAPPDATA?.trim() ?? join(homedir(), 'AppData', 'Local')
    return join(local, 'OpenPencil', 'Cache')
  }
  const xdg = process.env.XDG_CACHE_HOME?.trim() ?? join(homedir(), '.cache')
  return join(xdg, 'openpencil')
}

async function readDiskCache(): Promise<{ expiresAt: number; data: ModelsDevCatalog } | null> {
  try {
    const raw = await readFile(join(cacheDir(), 'models-dev.json'), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeDiskCache(data: ModelsDevCatalog): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true })
    const payload = JSON.stringify({ expiresAt: Date.now() + MODELS_DEV_CACHE_TTL_MS, data })
    await writeFile(join(cacheDir(), 'models-dev.json'), payload, 'utf-8')
  } catch {
    // Disk cache failures should never break the agent.
  }
}

let catalogPromise: Promise<ModelsDevCatalog | null> | null = null

function normalizeModel(id: string, model: ModelsDevModel): ModelOption {
  const capabilities: ('tools' | 'vision')[] = []
  if (model.tool_call === true) capabilities.push('tools')
  if (model.attachment === true) capabilities.push('vision')
  const output = model.limit?.output
  return {
    id,
    name: typeof model.name === 'string' && model.name ? model.name : id,
    capabilities,
    ...(typeof output === 'number' && Number.isFinite(output)
      ? { recommendedMaxOutputTokens: Math.min(128_000, Math.max(1024, output)) }
      : {})
  }
}

async function loadCatalog(fetcher: typeof fetch): Promise<ModelsDevCatalog | null> {
  const cached = await readDiskCache()
  if (cached && cached.expiresAt > Date.now()) return cached.data
  try {
    const response = await fetcher(MODELS_DEV_URL)
    if (!response.ok) throw new Error(`models.dev catalog request failed: ${response.status}`)
    const catalog = (await response.json()) as ModelsDevCatalog
    await writeDiskCache(catalog)
    return catalog
  } catch {
    return cached?.data ?? null
  }
}

function modelIDCandidates(providerKey: string, modelID: string): string[] {
  const unprefixed = modelID.startsWith(`${providerKey}/`)
    ? modelID.slice(providerKey.length + 1)
    : modelID
  return [
    ...new Set([
      modelID,
      unprefixed,
      unprefixed.replace(/-\d{8}$/, ''),
      unprefixed.replace(/:[a-z0-9-]+$/, '')
    ])
  ]
}

export async function resolveModelsDevModel(
  providerID: AIProviderID,
  modelID: string,
  fetcher: typeof fetch = globalThis.fetch
): Promise<ModelOption | null> {
  const providerKeys = PROVIDER_KEYS[providerID]
  if (!providerKeys?.length || !modelID) return null
  catalogPromise ??= loadCatalog(fetcher)
  const catalog = await catalogPromise
  if (!catalog) return null

  for (const providerKey of providerKeys) {
    const models = catalog[providerKey]?.models
    for (const candidate of modelIDCandidates(providerKey, modelID)) {
      const matched = models?.[candidate]
      if (matched) return normalizeModel(modelID, matched)
    }
  }
  return null
}

export function resetModelsDevCatalogForTests(): void {
  catalogPromise = null
}