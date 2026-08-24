/**
 * T24 brand 种子加载（T24-plan D6 薄切）：
 * YAML 种子单层（config.yaml 移植自上游 fork public/default-brand/config.yaml，
 * fork-owned 策划件——不机械同步上游）。后端启动加载，无 SQLite 覆盖层/CRUD/
 * 写路由（C2a 范围；接覆盖层时本装配层不变，只换数据源）。
 *
 * 种子缺失/解析失败 → null（合法降级态：overlay 输出 fallback 引导段，
 * manifest 返回空 types/profiles）。
 *
 * 仅运行于独立后端进程；markdown 正文不出本模块的服务端边界（manifest 脱敏）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from 'yaml'

import type {
  PiBrandManifest,
  PiBrandMaterialType,
  PiBrandStyleProfileSummary
} from './manifest'

const SEED_PATH = 'src/app/ai/pi-backend/brand/config.yaml'

export type PiBrandStyleProfile = PiBrandStyleProfileSummary & {
  /** profile 正文（只进 prompt，不进 manifest） */
  markdown: string
}

export type PiBrandConfig = {
  name: string
  types: PiBrandMaterialType[]
  profiles: PiBrandStyleProfile[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function parseType(value: unknown): PiBrandMaterialType | null {
  if (!isRecord(value)) return null
  const id = stringField(value.id)
  const label = stringField(value.label)
  if (!id || !label) return null
  return {
    id,
    label,
    ...(stringField(value.size) ? { size: stringField(value.size) } : {}),
    ...(stringField(value.description) ? { description: stringField(value.description) } : {})
  }
}

function parseProfile(value: unknown): PiBrandStyleProfile | null {
  if (!isRecord(value)) return null
  const id = stringField(value.id)
  const label = stringField(value.label)
  const markdown = stringField(value.markdown)
  if (!id || !label || !markdown) return null
  const applicableTo = Array.isArray(value.applicable_to)
    ? value.applicable_to.filter((entry): entry is string => typeof entry === 'string')
    : []
  return { id, label, applicableTo, markdown }
}

/** 读种子（缺文件/坏 YAML → null 降级，不抛） */
export function loadBrandSeed(rootDir: string): PiBrandConfig | null {
  let raw: string
  try {
    raw = readFileSync(join(rootDir, SEED_PATH), 'utf8')
  } catch {
    return null
  }
  try {
    const doc = parse(raw) as unknown
    if (!isRecord(doc)) return null
    const types = Array.isArray(doc.types)
      ? doc.types.map(parseType).filter((entry) => entry !== null)
      : []
    const profiles = Array.isArray(doc.profiles)
      ? doc.profiles.map(parseProfile).filter((entry) => entry !== null)
      : []
    return { name: stringField(doc.name) ?? '', types, profiles }
  } catch {
    return null
  }
}

/** manifest 投影：剥 markdown（信任边界：注入文本永远后端读，T24-plan D7） */
export function toBrandManifest(config: PiBrandConfig | null): PiBrandManifest {
  if (!config) return { name: '', types: [], profiles: [] }
  return {
    name: config.name,
    types: config.types,
    profiles: config.profiles.map(({ id, label, applicableTo }) => ({ id, label, applicableTo }))
  }
}
