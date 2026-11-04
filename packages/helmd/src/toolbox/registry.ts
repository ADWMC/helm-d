// Installed-tool registry. One JSON file under the runtime state directory;
// the catalog is the only install source, so this never contains arbitrary
// paths the model invented.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runtimeStateDir } from '../runtime-paths.js'

export interface InstalledTool {
  id: string
  name: string
  repo: string
  version: string
  path: string
  assetName: string
  sha256: string
  installedAt: string
}

export interface ToolRegistry {
  tools: Record<string, InstalledTool>
}

export function toolboxRoot(): string {
  return join(runtimeStateDir(), 'catalog')
}

export function registryPath(): string {
  return join(runtimeStateDir(), 'registry.json')
}

export function loadRegistry(): ToolRegistry {
  try {
    const parsed = JSON.parse(readFileSync(registryPath(), 'utf8')) as ToolRegistry
    return { tools: parsed && typeof parsed.tools === 'object' && parsed.tools !== null ? parsed.tools : {} }
  } catch {
    return { tools: {} }
  }
}

function saveRegistry(registry: ToolRegistry): void {
  const path = registryPath()
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(registry, null, 2), 'utf8')
  renameSync(temp, path)
}

export function installedTool(id: string): InstalledTool | undefined {
  return loadRegistry().tools[id]
}

export function listInstalled(): InstalledTool[] {
  return Object.values(loadRegistry().tools)
}

export function upsertInstalled(tool: InstalledTool): void {
  const registry = loadRegistry()
  registry.tools[tool.id] = tool
  saveRegistry(registry)
}

export function removeInstalled(id: string): InstalledTool | undefined {
  const registry = loadRegistry()
  const tool = registry.tools[id]
  if (tool === undefined) return undefined
  delete registry.tools[id]
  saveRegistry(registry)
  return tool
}

export function toolDir(id: string, version: string): string {
  const safeVersion = version.replace(/[^A-Za-z0-9._-]+/g, '_')
  return join(toolboxRoot(), id, safeVersion)
}
