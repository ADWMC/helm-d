// Catalog-driven GitHub release installer.
//
// Safety model:
//   - the ONLY install source is the bundled catalog (no arbitrary URL);
//   - assets must come from the catalogued repository's latest GitHub release;
//   - a SHA-256 digest published by GitHub is mandatory — unhashed assets are
//     refused (no TOFU installs);
//   - archives extract into a temp dir, symlinks are rejected, and the result
//     moves under <state>/helmd-tools/catalog/<id>/<tag>/;
//   - nothing is executed after install.

import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { requestBuffer, requestText } from '../star-gate.js'
import { assertWithinRoot } from '../seam.js'
import { catalogEntry, isGithubRepo, type ToolCatalogEntry } from './catalog.js'
import { installedTool, toolDir, toolboxRoot, upsertInstalled, removeInstalled, type InstalledTool } from './registry.js'

export interface ReleaseAsset {
  name: string
  size: number
  digest: string | null
  url: string
}

export interface ReleaseInfo {
  tag: string
  assets: ReleaseAsset[]
}

const ARCHIVE_RE = /\.(zip|tar\.gz|tgz|tar|tar\.xz|jar|exe)$/i
const MAX_ASSET_BYTES = 512 * 1024 * 1024

function ownerRepo(repo: string): { owner: string; repo: string } {
  if (!isGithubRepo(repo)) throw new Error(`not a GitHub repository: ${repo}`)
  const parts = repo.replace(/\/$/, '').split('/')
  return { owner: parts[3], repo: parts[4] }
}

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim()
  return {
    accept: 'application/vnd.github+json',
    ...(token !== undefined && token !== '' ? { authorization: `Bearer ${token}` } : {}),
  }
}

/** Latest release + its assets (digest is the GitHub-published sha256 when present). */
export async function latestRelease(entry: ToolCatalogEntry): Promise<ReleaseInfo> {
  const { owner, repo } = ownerRepo(entry.repo)
  const releasePath = entry.tag !== undefined && entry.tag !== ''
    ? `releases/tags/${encodeURIComponent(entry.tag)}`
    : 'releases/latest'
  const response = await requestText(`https://api.github.com/repos/${owner}/${repo}/${releasePath}`, {
    method: 'GET',
    headers: ghHeaders(),
  })
  if (response.status !== 200) throw new Error(`GitHub release lookup for ${owner}/${repo} failed: HTTP ${response.status}`)
  const data = JSON.parse(response.text) as {
    tag_name?: unknown
    assets?: Array<{ name?: unknown; size?: unknown; digest?: unknown; browser_download_url?: unknown; state?: unknown }>
  }
  const tag = typeof data.tag_name === 'string' ? data.tag_name : ''
  if (tag === '') throw new Error(`release for ${owner}/${repo} carries no tag`)
  const assets = (Array.isArray(data.assets) ? data.assets : [])
    .filter((asset) => asset.state !== 'incomplete' && typeof asset.name === 'string' && typeof asset.browser_download_url === 'string')
    .map((asset) => ({
      name: String(asset.name),
      size: Number(asset.size ?? 0),
      digest: typeof asset.digest === 'string' ? asset.digest : null,
      url: String(asset.browser_download_url),
    }))
  return { tag, assets }
}

/** Pick one installable asset: explicit name, a catalog asset pattern, or the
 *  only digest-pinned archive when there is exactly one. Ambiguity is an
 *  error, never a guess. */
export function chooseAsset(assets: ReleaseAsset[], requested?: string, pattern?: string): ReleaseAsset {
  if (requested !== undefined && requested !== '') {
    const exact = assets.find((asset) => asset.name === requested)
    if (exact === undefined) throw new Error(`release has no asset named ${requested}`)
    if (exact.digest === null) throw new Error(`asset ${exact.name} has no GitHub sha256 digest; refusing an unhashed install`)
    return exact
  }
  if (pattern !== undefined && pattern !== '') {
    let matcher: RegExp
    try { matcher = new RegExp(pattern) } catch { throw new Error(`catalog assetPattern is not a valid regex: ${pattern}`) }
    const matched = assets.filter((asset) => matcher.test(asset.name))
    if (matched.length === 0) throw new Error(`release has no asset matching ${pattern}; pass assetName`)
    if (matched.length > 1) throw new Error(`asset pattern ${pattern} is ambiguous (${matched.map((asset) => asset.name).join(', ')}); pass assetName`)
    if (matched[0].digest === null) throw new Error(`asset ${matched[0].name} has no GitHub sha256 digest; refusing an unhashed install`)
    return matched[0]
  }
  const candidates = assets.filter((asset) => asset.digest !== null && ARCHIVE_RE.test(asset.name))
  if (candidates.length === 1) return candidates[0]
  if (candidates.length === 0) throw new Error('release has no digest-pinned archive asset; install manually')
  throw new Error(`release has multiple assets (${candidates.map((asset) => asset.name).join(', ')}); pass assetName`)
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.once('end', () => resolve(hash.digest('hex')))
    stream.once('error', reject)
  })
}

function assertNoEscapingLinks(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw new Error(`archive contains a symlink (${name}); refusing to install`)
    if (stat.isDirectory()) assertNoEscapingLinks(path)
  }
}

function runExtractor(command: string, args: string[], cwd?: string): void {
  const result = spawnSync(command, args, { cwd, timeout: 120_000, encoding: 'utf8' })
  if (result.error !== undefined) throw new Error(`archive extraction failed: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`archive extraction failed: ${String(result.stderr ?? '').trim() || `${command} exit ${String(result.status)}`}`)
}

function extract(archivePath: string, destDir: string): void {
  // Windows ships libarchive's bsdtar (handles zip, tar.*, xz); Git's GNU tar
  // cannot read zip and parses a bare `C:\...` argument as a remote host.
  const systemTar = process.platform === 'win32'
    ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : undefined
  if (systemTar !== undefined && existsSync(systemTar)) {
    runExtractor(systemTar, ['-xf', basename(archivePath), '-C', destDir], dirname(archivePath))
    return
  }
  if (/\.zip$/i.test(archivePath)) {
    runExtractor('unzip', ['-o', archivePath, '-d', destDir])
    return
  }
  runExtractor('tar', ['-xf', basename(archivePath), '-C', destDir], dirname(archivePath))
}

/** Install one catalog release. Returns the installed registry row. */
export async function installCatalogTool(id: string, assetName?: string): Promise<InstalledTool> {
  const entry = catalogEntry(id)
  if (entry === undefined) throw new Error(`unknown catalog tool: ${id}`)
  if (entry.kind !== 'release') throw new Error(`${entry.name} is a ${entry.kind} tool; use: ${entry.installHint ?? entry.usage}`)

  const existing = installedTool(id)
  if (existing !== undefined) return existing

  const release = await latestRelease(entry)
  const asset = chooseAsset(release.assets, assetName ?? entry.asset, entry.assetPattern)
  if (asset.size > MAX_ASSET_BYTES) throw new Error(`asset is larger than ${MAX_ASSET_BYTES} bytes; install manually`)

  const root = toolboxRoot()
  mkdirSync(root, { recursive: true })
  const tempDir = join(root, '.tmp', `${id}-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })
  const archivePath = join(tempDir, basename(asset.name))
  try {
    const response = await requestBuffer(asset.url, { method: 'GET', headers: { accept: 'application/octet-stream' } })
    if (response.status !== 200) throw new Error(`asset download failed: HTTP ${response.status}`)
    if (response.buffer.length > MAX_ASSET_BYTES) throw new Error('downloaded asset exceeds the size cap')
    writeFileSync(archivePath, response.buffer)
    const actual = await sha256File(archivePath)
    const expected = asset.digest?.replace(/^sha256:/i, '').toLowerCase()
    if (expected === undefined || expected === '' || actual !== expected) {
      throw new Error(`sha256 mismatch for ${asset.name}: expected ${expected ?? '(none)'}, got ${actual}`)
    }

    const extractDir = join(tempDir, 'x')
    mkdirSync(extractDir, { recursive: true })
    if (/\.(zip|tar\.gz|tgz|tar|tar\.xz)$/i.test(asset.name)) extract(archivePath, extractDir)
    else copyFileSync(archivePath, join(extractDir, basename(asset.name)))
    assertNoEscapingLinks(extractDir)

    const dest = toolDir(id, release.tag)
    assertWithinRoot(dest, root)
    if (existsSync(dest)) throw new Error(`install directory already exists: ${dest}`)
    mkdirSync(join(dest, '..'), { recursive: true })
    renameSync(extractDir, dest)

    const tool: InstalledTool = {
      id,
      name: entry.name,
      repo: entry.repo,
      version: release.tag,
      path: dest,
      assetName: asset.name,
      sha256: actual,
      installedAt: new Date().toISOString(),
    }
    upsertInstalled(tool)
    return tool
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

/** Update one installed catalog tool to its latest release. The old registry
 *  row is restored if the download/extract fails; the old directory is removed
 *  only after the new install is in place. */
export async function updateCatalogTool(id: string, assetName?: string): Promise<InstalledTool> {
  const existing = installedTool(id)
  if (existing === undefined) return installCatalogTool(id, assetName)
  const entry = catalogEntry(id)
  if (entry === undefined) throw new Error(`unknown catalog tool: ${id}`)
  if (entry.kind !== 'release') throw new Error(`${entry.name} is a ${entry.kind} tool; use: ${entry.installHint ?? entry.usage}`)
  const backup = `${existing.path}.old-${Date.now()}`
  let moved = false
  if (existsSync(existing.path)) {
    renameSync(existing.path, backup)
    moved = true
  }
  removeInstalled(id)
  try {
    const installed = await installCatalogTool(id, assetName)
    if (moved) rmSync(backup, { recursive: true, force: true })
    if (installed.path !== existing.path && existsSync(existing.path)) rmSync(existing.path, { recursive: true, force: true })
    return installed
  } catch (error) {
    upsertInstalled(existing)
    if (moved && !existsSync(existing.path)) renameSync(backup, existing.path)
    else if (moved) rmSync(backup, { recursive: true, force: true })
    throw error
  }
}

/** Install a local archive (offline mirror). The digest is mandatory and is
 *  supplied by the operator; this never downloads anything. */
export async function installCatalogMirror(id: string, archivePath: string, sha256: string): Promise<InstalledTool> {
  const entry = catalogEntry(id)
  if (entry === undefined) throw new Error(`unknown catalog tool: ${id}`)
  if (entry.kind !== 'release') throw new Error(`${entry.name} is a ${entry.kind} tool; use: ${entry.installHint ?? entry.usage}`)
  const expected = sha256.trim().toLowerCase().replace(/^sha256:/, '')
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('sha256 must be 64 hex characters')
  const source = join(archivePath)
  if (!existsSync(source)) throw new Error(`mirror archive not found: ${source}`)
  const bytes = readFileSync(source)
  if (bytes.length > MAX_ASSET_BYTES) throw new Error(`mirror archive is larger than ${MAX_ASSET_BYTES} bytes`)
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== expected) throw new Error(`sha256 mismatch for mirror: expected ${expected}, got ${actual}`)
  const root = toolboxRoot()
  mkdirSync(root, { recursive: true })
  const tempDir = join(root, '.tmp', `${id}-mirror-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })
  try {
    const local = join(tempDir, basename(archivePath))
    writeFileSync(local, bytes)
    const extractDir = join(tempDir, 'x')
    mkdirSync(extractDir, { recursive: true })
    if (/\.(zip|tar\.gz|tgz|tar|tar\.xz)$/i.test(local)) extract(local, extractDir)
    else copyFileSync(local, join(extractDir, basename(archivePath)))
    assertNoEscapingLinks(extractDir)
    const version = `mirror-${actual.slice(0, 8)}`
    const dest = toolDir(id, version)
    assertWithinRoot(dest, root)
    if (existsSync(dest)) throw new Error(`install directory already exists: ${dest}`)
    mkdirSync(join(dest, '..'), { recursive: true })
    renameSync(extractDir, dest)
    const tool: InstalledTool = {
      id,
      name: entry.name,
      repo: entry.repo,
      version,
      path: dest,
      assetName: basename(archivePath),
      sha256: actual,
      installedAt: new Date().toISOString(),
    }
    upsertInstalled(tool)
    return tool
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

/** Remove one installed catalog tool. Refuses paths outside the tool root. */
export function uninstallCatalogTool(id: string): InstalledTool {
  const tool = installedTool(id)
  if (tool === undefined) throw new Error(`tool is not installed: ${id}`)
  assertWithinRoot(tool.path, toolboxRoot())
  rmSync(tool.path, { recursive: true, force: true })
  removeInstalled(id)
  return tool
}

/** Read-only health: installed, directory present, size of the install dir. */
export function toolHealth(id: string): { installed: boolean; version?: string; path?: string; present?: boolean } {
  const tool = installedTool(id)
  if (tool === undefined) return { installed: false }
  return { installed: true, version: tool.version, path: tool.path, present: existsSync(tool.path) && statSync(tool.path).isDirectory() }
}
