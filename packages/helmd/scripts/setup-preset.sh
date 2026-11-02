#!/usr/bin/env bash
# scripts/setup-preset.sh -- re-derive this package's preset patch against the
# dsh host installed on THIS machine.
#
# dsh >= 0.1.7 changed the model: a preset is one composition row
# (@deepseek-ai/dsh-agent-preset) that the bundle declares through
# dsh.bundle.patch, so there is no `.agent-presets/<name>/` deployment left and
# nothing to copy. The artifact lives inside the package
# (preset.generated.patch.yml); this script only regenerates it from the local
# host's own standard preset, which is what a host upgrade requires.
#
# Usage: ./scripts/setup-preset.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../preset.generated.patch.yml"
GEN_SCRIPT="$SCRIPT_DIR/gen-preset.mjs"

command -v node >/dev/null 2>&1 || {
  echo "node is required to regenerate the preset patch (gen-preset.mjs reads the installed dsh standard)"
  exit 1
}
[ -f "$GEN_SCRIPT" ] || { echo "generator not found at $GEN_SCRIPT (run from inside the installed package)"; exit 1; }

[ -f "$TARGET" ] && { cp "$TARGET" "$TARGET.bak"; echo "  kept $TARGET.bak"; }

# gen-preset asserts the artifact's shape and writes nothing when the host
# predates 0.1.7 or the assertion fails, so a non-zero exit leaves the current
# patch untouched.
if ! node "$GEN_SCRIPT" --out "$TARGET"; then
  echo "gen-preset failed; $TARGET was left as-is"
  exit 1
fi

echo "[done] preset patch re-derived from the installed dsh standard"
echo "[next] restart dsh, then assert the first request's tool catalog (MAINTENANCE section 8)"
