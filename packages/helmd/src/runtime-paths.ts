// Shared local state directory for runtime hooks that predate the tool ledger.
// HELMD_TOOLS_DIR is kept as the override name for backward compatibility
// (advisory + stream-transport logs have always lived here).
import { homedir } from 'node:os'
import { join } from 'node:path'

export function runtimeStateDir(): string {
  const env = process.env.HELMD_TOOLS_DIR?.trim()
  return env || join(homedir(), '.dsh', 'helmd-tools')
}
