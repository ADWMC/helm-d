import type { Context } from '@deepseek-ai/cordis'
import { accessSync, constants } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { delimiter, join, normalize, resolve, sep } from 'node:path'

const execFileAsync = promisify(execFile)
const MAX_OUTPUT_BYTES = 256 * 1024
const GRACE_MS = 30_000

const INTERPRETER_ALIASES: Record<string, string[]> = {
  python: ['python', 'py', 'python3'],
  bash: ['bash'],
}

interface OutputReader { readFrom(offset: number): { text: string } | undefined }
interface SubprocessHandleLike {
  done: Promise<{ exitCode: number | null }>
  collected?: { stdout?: OutputReader; stderr?: OutputReader }
}

function findOnPath(cmd: string): string | null {
  const pathext = (process.env.PATHEXT ?? '').split(';').filter(Boolean)
  const exts = ['', ...pathext]
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const full = join(dir, cmd + ext)
      try {
        accessSync(full, constants.F_OK)
        return full
      } catch {
        // next candidate
      }
    }
  }
  return null
}

/** Resolve an interpreter/command through the subprocess seam, then the local PATH. */
export async function resolveCommand(_ctx: Context, command: string): Promise<string> {
  const subprocess = safeService<any>(_ctx, 'subprocess')
  if (subprocess != null && typeof subprocess.resolveExecutable === 'function') {
    try {
      const resolved = await subprocess.resolveExecutable(command)
      if (resolved) return resolved
    } catch {
      // fall through to local resolution
    }
  }
  for (const candidate of INTERPRETER_ALIASES[command] ?? [command]) {
    const found = findOnPath(candidate)
    if (found) return found
  }
  // Windows py launcher fallback: try `py -3` if plain `py` not found
  if (command === 'python' && process.platform === 'win32') {
    const py = findOnPath('py')
    if (py) return py
  }
  return command
}

/** Validate and normalize a path stays within the allowed root. */
export function assertWithinRoot(absPath: string, root: string): string {
  const normalized = normalize(absPath)
  const normalizedRoot = normalize(root)
  const prefix = normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep
  if (normalized !== normalizedRoot && !normalized.startsWith(prefix)) {
    throw new Error('path out of scope')
  }
  return normalized
}


/**
 * Prefer the ctx.fs capability seam; fall back to the local Node fs
 * when the host has no provider.
 */
export async function readTextSeam(ctx: Context, absPath: string): Promise<string> {
  const fs = ctx.get('fs')
  if (fs != null && typeof fs.resolve === 'function' && typeof fs.readText === 'function') {
    const target = await fs.resolve(absPath)
    return await fs.readText(target)
  }
  return await readFile(absPath, 'utf8')
}

/**
 * Prefer the ctx.subprocess capability seam; fall back to a local Node
 * spawn when the host has no provider.
 */
export async function runSeam(ctx: Context, argv: string[], cwd: string): Promise<string> {
  const program = await resolveCommand(ctx, argv[0])
  const resolvedArgv = [program, ...argv.slice(1)]
  const subprocess = ctx.get('subprocess')
  if (subprocess != null && typeof subprocess.spawn === 'function') {
    const handle = subprocess.spawn({
      argv: resolvedArgv,
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_OUTPUT_BYTES * 8 } },
        stderr: { maxBytes: MAX_OUTPUT_BYTES },
      },
      graceMs: GRACE_MS,
      env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    }) as SubprocessHandleLike
    const outcome = await handle.done
    const out = handle.collected?.stdout?.readFrom(0)?.text ?? ''
    const err = handle.collected?.stderr?.readFrom(0)?.text ?? ''
    if (outcome.exitCode !== 0) {
      throw new Error(`${program} exited with code ${outcome.exitCode}${err ? `: ${err.trim()}` : ''}`)
    }
    return out
  }
  try {
    const { stdout } = await execFileAsync(resolvedArgv[0], resolvedArgv.slice(1), {
      cwd,
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: GRACE_MS,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
    return stdout
  } catch (error) {
    const e = error as any
    throw new Error(`${program} failed: ${e?.stderr ?? e?.message ?? String(e)}`)
  }
}

/**
 * Safely look up an optional service from a Cordis context without triggering
 * the "cannot get property <name> without inject" proxy error.
 */
export function safeService<T = unknown>(ctx: unknown, name: string): T | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined
  const c = ctx as any
  try {
    if (typeof c.get === 'function') {
      const s = c.get(name)
      if (s != null) return s
    }
  } catch {}
  try {
    const root = c.root
    if (root && root !== c && typeof root.get === 'function') {
      const s = root.get(name)
      if (s != null) return s
    }
  } catch {}
  try {
    if (c.reflect && typeof c.reflect.get === 'function') {
      const s = c.reflect.get(name, false)
      if (s != null) return s
    }
  } catch {}
  try {
    const root = c.root
    if (root && root !== c && root.reflect && typeof root.reflect.get === 'function') {
      const s = root.reflect.get(name, false)
      if (s != null) return s
    }
  } catch {}
  return undefined
}
