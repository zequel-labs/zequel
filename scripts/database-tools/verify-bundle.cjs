// electron-builder loads hooks through CommonJS before packaging or publishing.
const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const { readFile, realpath, stat } = require('node:fs/promises')
const { resolve, relative, isAbsolute, sep } = require('node:path')
const { Arch } = require('builder-util')

const REQUIRED = {
  postgresql: ['pg_dump', 'pg_restore', 'psql'], mysql: ['mysqldump', 'mysql'],
  mariadb: ['mariadb-dump', 'mariadb'], mongodb: ['mongodump', 'mongorestore'],
  sqlite: ['sqlite3'], duckdb: ['duckdb'], sqlserver: ['sqlcmd'],
}
const digest = async path => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
const verifyBundle = async (platform, arch, project = process.cwd()) => {
  const root = resolve(project, 'resources/database-tools', `${platform}-${arch}`)
  const canonical = await realpath(root)
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
  if (manifest.platform !== platform || manifest.arch !== arch) throw new Error('Wrong database toolchain platform or architecture')
  const checkedPath = async name => {
    if (typeof name !== 'string' || !name || isAbsolute(name)) throw new Error('Invalid toolchain path')
    const path = await realpath(resolve(root, name))
    const local = relative(canonical, path)
    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Toolchain path escapes bundle')
    if (!(await stat(path)).isFile()) throw new Error(`Not a toolchain file: ${name}`)
    return path
  }
  for (const [engine, binaries] of Object.entries(REQUIRED)) {
    const tools = manifest.tools.filter(tool => tool.engine === engine)
    if (tools.length !== 1) throw new Error(`Expected one verified ${engine} toolchain for ${platform}-${arch}`)
    const tool = tools[0]
    if (!tool.version || !tool.files || !Object.keys(tool.files).some(name => name.includes('/licenses/'))) throw new Error(`Incomplete ${engine} provenance or licenses`)
    for (const binary of binaries) {
      const name = tool.binaries[binary]
      const path = await checkedPath(name)
      if (!tool.files[name]) throw new Error(`Unverified executable: ${binary}`)
      if (platform !== 'win32' && !((await stat(path)).mode & 0o111)) throw new Error(`Not executable: ${binary}`)
    }
    for (const [name, expected] of Object.entries(tool.files)) {
      if (!/^[a-f0-9]{64}$/.test(expected) || await digest(await checkedPath(name)) !== expected) throw new Error(`Database tool checksum mismatch: ${name}`)
    }
  }
  console.log(`Verified all seven native database toolchains for ${platform}-${arch}`)
}
module.exports = async context => verifyBundle(context.electronPlatformName, Arch[context.arch], context.packager.projectDir)
module.exports.verifyBundle = verifyBundle
if (require.main === module) verifyBundle(process.argv[2] || process.platform, process.argv[3] || process.arch).catch(error => { console.error(error.message); process.exitCode = 1 })
