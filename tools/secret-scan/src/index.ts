const GITLEAKS_VERSION = 'v8.30.1'
const GITLEAKS_MODULE = `github.com/zricethezav/gitleaks/v8@${GITLEAKS_VERSION}`

const gitleaksArgs = ['dir', '--config', '.gitleaks.toml', '--redact', '--no-banner', '.']

function run(command: string, args: string[]): Bun.SpawnSyncReturns<Buffer> | null {
  try {
    return Bun.spawnSync([command, ...args], {
      stdout: 'inherit',
      stderr: 'inherit'
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const proc = run('gitleaks', gitleaksArgs) ?? run('go', ['run', GITLEAKS_MODULE, ...gitleaksArgs])

// T27：缺二进制（gitleaks 与 go 都没装的环境受限机器）不是扫描失败——
// 明确打印 SKIPPED 并 exit 0；CI runner 镜像自带 go（go run 兜底路径），仍真扫。
if (!proc) {
  console.log(
    'Secret scan SKIPPED: gitleaks/go not installed (environment-limited; CI runs the real scan).'
  )
  process.exit(0)
}

if (!proc.success) {
  console.error('Secret scan failed.')
  process.exit(proc.exitCode || 1)
}

console.log('Secret scan passed.')
