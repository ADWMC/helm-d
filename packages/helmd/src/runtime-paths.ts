// Shared local state directory for runtime hooks that predate the tool ledger.
// HELMD_TOOLS_DIR overrides it; otherwise follow $DSH_HOME so isolated profiles
// and tests do not write into the operator's real state.
import { homedir } from 'node:os'
import { join } from 'node:path'

export function runtimeStateDir(): string {
  const env = process.env.HELMD_TOOLS_DIR?.trim()
  if (env) return env
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(home, 'helmd-tools')
}
