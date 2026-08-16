import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const DIR_NAME_MACOS = 'OpenPencil'
const DIR_NAME_UNIX = 'openpencil'
const DISCOVERY_FILENAME = 'agent.json'

export interface AgentDiscoveryInfo {
  pid: number
  httpPort: number
  version: string
  startedAt: string
}

async function getPlatformDir(): Promise<string> {
  let dir: string
  if (platform() === 'darwin') {
    dir = join(homedir(), 'Library', 'Application Support', DIR_NAME_MACOS)
  } else if (platform() === 'win32') {
    const local = process.env.LOCALAPPDATA?.trim()
    dir = local ? join(local, DIR_NAME_MACOS) : join(homedir(), 'AppData', 'Local', DIR_NAME_MACOS)
  } else {
    const xdg = process.env.XDG_RUNTIME_DIR?.trim()
    dir = xdg ? join(xdg, DIR_NAME_UNIX) : join(homedir(), `.${DIR_NAME_UNIX}`)
  }
  await mkdir(dir, { recursive: true, mode: 0o700 })
  if (platform() !== 'win32') await chmod(dir, 0o700)
  return dir
}

async function getDiscoveryPath(): Promise<string> {
  const override = process.env.OPENPENCIL_AGENT_DISCOVERY_PATH?.trim()
  if (override) {
    const dir = join(override, '..')
    await mkdir(dir, { recursive: true, mode: 0o700 })
    return override
  }
  const dir = await getPlatformDir()
  return join(dir, DISCOVERY_FILENAME)
}

export async function writeAgentDiscovery(info: AgentDiscoveryInfo): Promise<string> {
  const path = await getDiscoveryPath()
  const json = JSON.stringify(info, null, 2)
  const random = randomBytes(6).toString('hex')
  const tmpPath = `${path}.${process.pid}.${random}.tmp`
  await writeFile(tmpPath, json, { mode: 0o600, encoding: 'utf-8' })
  try {
    await rename(tmpPath, path)
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined)
    throw err
  }
  return path
}

export async function readAgentDiscovery(): Promise<AgentDiscoveryInfo | null> {
  const path = await getDiscoveryPath()
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const { pid, httpPort, version, startedAt } = obj
  if (typeof pid !== 'number' || pid <= 0) return null
  if (typeof httpPort !== 'number' || httpPort < 0 || httpPort > 65535) return null
  if (typeof version !== 'string') return null
  if (typeof startedAt !== 'string') return null
  if (!isProcessAlive(pid)) return null
  return { pid, httpPort, version, startedAt }
}

export async function removeAgentDiscovery(): Promise<void> {
  const path = await getDiscoveryPath()
  try {
    await unlink(path)
  } catch {
    // ignore — nothing to remove
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ESRCH') {
      return false
    }
    return true
  }
}