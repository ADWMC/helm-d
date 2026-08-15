import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_OUTPUT_BYTES = 256 * 1024
const GRACE_MS = 30_000

interface OutputReader { readFrom(offset: number): { text: string } }
interface SubprocessHandleLike {
  done: Promise<{ exitCode: number | null }>
  collected?: { stdout?: OutputReader; stderr?: OutputReader }
}

/** Prefer the ctx.fs capability seam; fall back to the local Node fs when the host has no provider. */
export async function readTextSeam(ctx: Context, absPath: string): Promise<string> {
  const fs = ctx.get('fs')
  if (fs != null && typeof fs.resolve === 'function' && typeof fs.readText === 'function') {
    const target = await fs.resolve(absPath)
    return await fs.readText(target)
  }
  return await readFile(absPath, 'utf8')
}

/** Prefer the ctx.subprocess capability seam; fall back to a local Node spawn when the host has no provider. */
export async function runSeam(ctx: Context, argv: string[], cwd: string): Promise<string> {
  const subprocess = ctx.get('subprocess')
  if (subprocess != null && typeof subprocess.spawn === 'function') {
    const handle = subprocess.spawn({
      argv,
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_OUTPUT_BYTES * 8 } },
        stderr: { maxBytes: MAX_OUTPUT_BYTES },
      },
      graceMs: GRACE_MS,
    }) as SubprocessHandleLike
    const outcome = await handle.done
    const out = handle.collected?.stdout?.readFrom(0).text ?? ''
    const err = handle.collected?.stderr?.readFrom(0).text ?? ''
    if (outcome.exitCode !== 0) {
      throw new Error(`${argv[0]} exited with code ${outcome.exitCode}${err ? `: ${err.trim()}` : ''}`)
    }
    return out
  }
  try {
    const { stdout } = await execFileAsync(argv[0], argv.slice(1), {
      cwd,
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: GRACE_MS,
    })
    return stdout
  } catch (error) {
    const e = error as any
    throw new Error(`${argv[0]} failed: ${e?.stderr ?? e?.message ?? String(e)}`)
  }
}
