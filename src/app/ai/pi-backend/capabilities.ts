/**
 * T87：Agent 能力总开关（pi 原生 skill 支持 + 内建工具同闸）。
 *
 * 存储：.openpencil/pi-agent/capabilities.json（tmp+rename 原子写；坏 JSON
 * 降级 OFF——同 image-gen/credentials 纪律但无敏感字段，0o600 仅对齐设置文件
 * 既存卫生标准；绝无任何 key/secret 字段）。
 *
 * 单开关语义（owner 决策 ①）：
 *  - agentSkills: boolean ——启用时一并打开 skill 加载（pi SDK 路径）与内建
 *    工具（read/bash/edit/write——T20 起 noTools: 'builtin' 关闭）；关闭时两者
 *    同步回到 OFF 状态。缺省 OFF（首次配置前不暴露新攻击面）。
 *
 * 脱敏边界（T45 同源约束）：
 *  - getCapabilitiesForManifest() 投影只用 name + description，**绝不返回**
 *    filePath / baseDir / sourceInfo——这些是宿主内部坐标系，下发前端
 *    即泄漏内部路径（与 T45 §信任边界同质）。
 *  - T89：扫描目录改为单源 `${rootDir}/.openpencil/skills`（与 key-env /
 *    pi-agent / pi-sessions 同层私有状态目录），原 `${cwd}/.pi/skills` 与
 *    「pi coding agent」生态位冲突，已删除；agentDir/skills 也删除（agentDir
 *    仅用于 capabilities.json 持久化，不再承担 skill 扫描）。
 *  - 用 loadSkillsFromDir 单目录扫描，不暴露 SDK 默认扫描假设。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { type Skill, loadSkillsFromDir } from '@earendil-works/pi-coding-agent'

/**
 * 持久化形状：版本号字段防升级期旧文件残留。布尔外不留用户可调字段——
 * 扩展面走新键 + 版本号 + 读时兼容（坏文件/缺字段 → 落到 OFF）。
 */
interface CapabilitiesFile {
  version: 1
  agentSkills: boolean
}

const DEFAULTS: CapabilitiesFile = { version: 1, agentSkills: false }

export type Capabilities = {
  /** agentSkills 单开关；service.ts 装配据此切换 noTools/noSkills */
  agentSkills: boolean
}

/**
 * 投影脱敏后的 skill 条目（manifest 透传前端 chips 用）。
 * 注意：仅投影 name/description；filePath/baseDir 永不跨出后端进程。
 */
export type ManifestSkillEntry = {
  name: string
  description: string
}

export type CapabilitiesStore = {
  /** 进程级内存缓存；缺省 OFF；返回纯值对象（解构给 service.ts / GET 端点共用） */
  get(): Capabilities
  /**
   * PUT 写入：agentSkills 非布尔 → 抛错；正常路径落盘 + 更新缓存；
   * 返回最新 Capabilities（含校验后的归一值）。
   */
  set(input: { agentSkills: unknown }): Capabilities
  /**
   * 扫描能力开关打开时实际可见的 skill 列表（脱敏投影）。
   * OFF 时返回 []——避免在能力未授权时泄露已扫到的 skill 存在性。
   */
  listSkills(): ManifestSkillEntry[]
}

export function createCapabilitiesStore({
  agentDir,
  rootDir
}: {
  agentDir: string
  rootDir: string
}): CapabilitiesStore {
  const filePath = join(agentDir, 'capabilities.json')
  let cache: Capabilities | null | undefined

  function readFromDisk(): Capabilities {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<CapabilitiesFile>
      if (typeof raw.agentSkills === 'boolean') {
        return { agentSkills: raw.agentSkills }
      }
      return { agentSkills: DEFAULTS.agentSkills }
    } catch {
      // ENOENT / 坏 JSON → 缺省 OFF（capabilities 面 fail-safe，
      // 缺配置/坏文件视为未授权，避免把半残状态带入 session）
      return { agentSkills: DEFAULTS.agentSkills }
    }
  }

  function get(): Capabilities {
    if (cache === null || cache === undefined) cache = readFromDisk()
    return { agentSkills: cache.agentSkills }
  }

  function writeToDisk(next: Capabilities): void {
    mkdirSync(agentDir, { recursive: true })
    const doc: CapabilitiesFile = { version: 1, agentSkills: next.agentSkills }
    const tmpPath = `${filePath}.tmp`
    // 0o600 与 settings 文件齐平（capabilities 不含敏感字段，但同目录
    // 其他文件（auth.json/image-gen.json）已是 0o600，统一防越权读）
    writeFileSync(tmpPath, JSON.stringify(doc, null, 2), { mode: 0o600 })
    renameSync(tmpPath, filePath)
  }

  function set(input: { agentSkills: unknown }): Capabilities {
    if (typeof input.agentSkills !== 'boolean') {
      throw new TypeError('agentSkills must be boolean')
    }
    const next: Capabilities = { agentSkills: input.agentSkills }
    writeToDisk(next)
    cache = next
    return next
  }

  function projectSkill(skill: Skill): ManifestSkillEntry {
    // 脱敏：仅透传 name/description；缺 description 兜空串（chips 渲染统一）
    return {
      name: skill.name,
      description: typeof skill.description === 'string' ? skill.description : ''
    }
  }

  function listSkills(): ManifestSkillEntry[] {
    const caps = get()
    if (!caps.agentSkills) return []
    // T89：单源扫描 `.openpencil/skills`（私有状态目录，与 key-env/pi-agent 同层）——
    // 不调 loadSkills 全局版，避免引入 cwd/agentDir 之外的隐式来源
    const userSkillsDir = join(rootDir, '.openpencil', 'skills')
    if (!existsSync(userSkillsDir)) return []
    const result = loadSkillsFromDir({ dir: userSkillsDir, source: 'user' })
    return result.skills.map(projectSkill)
  }

  return { get, set, listSkills }
}
