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
import { copyFileSync, createReadStream, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
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

const ARCHIVE_RE = /\.(zip|tar\.gz|tgz|tar|exe)$/i
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
  const response = await requestText(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
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

/** Pick one installable asset: explicit name, or the only digest-pinned
 *  archive when there is exactly one. Ambiguity is an error, never a guess. */
export function chooseAsset(assets: ReleaseAsset[], requested?: string): ReleaseAsset {
  if (requested !== undefined && requested !== '') {
    const exact = assets.find((asset) => asset.name === requested)
    if (exact === undefined) throw new Error(`release has no asset named ${requested}`)
    if (exact.digest === null) throw new Error(`asset ${exact.name} has no GitHub sha256 digest; refusing an unhashed install`)
    if (!ARCHIVE_RE.test(exact.name)) throw new Error(`asset ${exact.name} is not a supported archive/exe`)
    return exact
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

function extract(archivePath: string, destDir: string): void {
  const result = spawnSync('tar', ['-xf', archivePath, '-C', destDir], { timeout: 120_000, encoding: 'utf8' })
  if (result.error !== undefined) throw new Error(`archive extraction failed: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`archive extraction failed: ${String(result.stderr ?? '').trim() || `tar exit ${String(result.status)}`}`)
}

/** Install one catalog release. Returns the installed registry row. */
export async function installCatalogTool(id: string, assetName?: string): Promise<InstalledTool> {
  const entry = catalogEntry(id)
  if (entry === undefined) throw new Error(`unknown catalog tool: ${id}`)
  if (entry.kind !== 'release') throw new Error(`${entry.name} is a ${entry.kind} tool; use: ${entry.installHint ?? entry.usage}`)

  const existing = installedTool(id)
  if (existing !== undefined) return existing

  const release = await latestRelease(entry)
  const asset = chooseAsset(release.assets, assetName)
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
    if (/\.(exe)$/i.test(asset.name)) copyFileSync(archivePath, join(extractDir, basename(asset.name)))
    else extract(archivePath, extractDir)
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
