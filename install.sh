#!/usr/bin/env bash
# One-command deploy for helmd: install the 9 bundles, mount the preset,
# and set it as the default agent preset.
set -euo pipefail

PROFILE="${1:-web}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PRESET="helmd"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/3] installing @dsh-security/* into profile '$PROFILE' ..."
dsh plugin --profile "$PROFILE" add \
  @dsh-security/bootstrap \
  @dsh-security/router \
  @dsh-security/skill-android \
  @dsh-security/skill-web \
  @dsh-security/skill-native \
  @dsh-security/skill-protocol \
  @dsh-security/skill-malware \
  @dsh-security/skill-ai-security \
  @dsh-security/skill-evidence

echo "[2/3] mounting preset ..."
mkdir -p "$DSH_HOME/.agent-presets/$PRESET"
cp "$HERE/presets/full-reverse/agent.cordis.yml" "$DSH_HOME/.agent-presets/$PRESET/"
cp "$HERE/presets/full-reverse/preset.yml" "$DSH_HOME/.agent-presets/$PRESET/"

echo "[3/3] setting default preset ..."
SETTINGS="$DSH_HOME/settings.yaml"
mkdir -p "$DSH_HOME"
[ -f "$SETTINGS" ] || : > "$SETTINGS"
if grep -q '^agent-presets:' "$SETTINGS"; then
  awk -v preset="$PRESET" '
    /^agent-presets:/ { print; inap=1; next }
    inap && /^[[:space:]]*default:/ { print "  default: " preset; inap=0; next }
    inap && /^[[:space:]]*[A-Za-z_][A-Za-z0-9_-]*:/ { print "  default: " preset; inap=0; print; next }
    { print }
  ' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
else
  printf '\nagent-presets:\n  default: %s\n' "$PRESET" >> "$SETTINGS"
fi

echo
echo "done. run: dsh $PROFILE   (or: dsh web)"
echo "then send the activation word: $PRESET"
