#!/usr/bin/env bash
# scripts/setup-preset.sh -- write the helmd agent preset from the files
# shipped inside this bundle. Run after ANY install method (store, URL, local
# tarball) to get the full persona + tool configuration.
#
# Usage: ./scripts/setup-preset.sh [preset-name]   (default: helmd)

set -euo pipefail

PRESET="${1:-helmd}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/../presets"

if [ ! -f "$SRC/agent.cordis.yml" ]; then
  echo "preset templates not found at $SRC (run from inside the installed package)"
  exit 1
fi

PRESET_DIR="$DSH_HOME/.agent-presets/$PRESET"
mkdir -p "$PRESET_DIR"

# Regenerate against the LOCAL host inside this run: platform rows must match
# the installed dsh, not the release snapshot. Fall back to snapshot when node
# or the generator is unavailable.
GEN_SCRIPT="$SCRIPT_DIR/gen-preset.mjs"
GENERATED=false
if command -v node >/dev/null 2>&1 && [ -f "$GEN_SCRIPT" ]; then
  if node "$GEN_SCRIPT" --out "$PRESET_DIR" && [ -f "$PRESET_DIR/agent.cordis.yml" ]; then
    GENERATED=true
    echo "  [gen] preset regenerated from local dsh standard (match this host)"
  else
    echo "  [gen] generator failed; falling back to snapshot"
  fi
fi

for f in preset.yml agent.cordis.yml; do
  if [ -f "$PRESET_DIR/$f" ]; then cp "$PRESET_DIR/$f" "$PRESET_DIR/$f.bak"; fi
  if [ "$f" = "agent.cordis.yml" ] && [ "$GENERATED" = "true" ]; then
    echo "  kept generated $f"
  else
    cp "$SRC/$f" "$PRESET_DIR/$f"
    echo "  wrote $f"
  fi
done
echo "[done] preset '$PRESET' written to $PRESET_DIR"
echo "pick '$PRESET' in the UI preset picker when starting a session."
