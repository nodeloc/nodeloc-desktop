const { createHash } = require('node:crypto')
const { copyFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

if (process.platform !== 'win32') process.exit(0)

const root = resolve(__dirname, '..')
const electronDir = join(root, 'node_modules', 'electron', 'dist')
const sourceExecutable = join(electronDir, 'electron.exe')
const executable = join(electronDir, 'NodeLoc.exe')
const electronPathFile = join(root, 'node_modules', 'electron', 'path.txt')
const icon = join(root, 'resources', 'icon.ico')
const editor = join(root, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
const marker = join(electronDir, '.nodeloc-icon-sha256')

for (const path of [sourceExecutable, electronPathFile, icon, editor]) {
  if (!existsSync(path)) throw new Error(`Missing development icon dependency: ${path}`)
}

const iconHash = createHash('sha256').update(readFileSync(icon)).digest('hex')
const markerValue = `nodeloc-exe-v2:${iconHash}`
if (
  existsSync(executable) &&
  existsSync(marker) &&
  readFileSync(marker, 'utf8').trim() === markerValue &&
  readFileSync(electronPathFile, 'utf8') === 'NodeLoc.exe'
) process.exit(0)

copyFileSync(sourceExecutable, executable)

const result = spawnSync(
  editor,
  [
    executable,
    '--set-icon',
    icon,
    '--set-version-string',
    'ProductName',
    'NodeLoc',
    '--set-version-string',
    'FileDescription',
    'NodeLoc Desktop',
    '--set-version-string',
    'InternalName',
    'NodeLoc'
  ],
  { encoding: 'utf8' }
)

if (result.status !== 0) {
  const detail = (result.stderr || result.stdout || '').trim()
  throw new Error(`Could not apply the NodeLoc development icon. Fully quit the running app and retry.${detail ? `\n${detail}` : ''}`)
}

writeFileSync(electronPathFile, 'NodeLoc.exe')
writeFileSync(marker, `${markerValue}\n`)
process.stdout.write('Prepared the branded NodeLoc development executable.\n')
