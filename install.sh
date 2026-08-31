#!/usr/bin/env bash
# One-command deploy for helmd: download the latest release tarball, write the
# preset inline, and set it as the default agent preset.
set -euo pipefail

PROFILE="${1:-web}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PRESET="helmd"
REPO="ADWMC/helm-d"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
CACHE_DIR="$DSH_HOME/.tgz-cache"
mkdir -p "$CACHE_DIR"

echo "[1/4] downloading latest release tarball from $REPO ..."
# latest/download stable URL: 恒指向最新 release，免 API、免版本发现、无回退点
AUTH=()
[ -n "${GH_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GH_TOKEN")
if [ -z "${GH_TOKEN:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
  AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi

TGZ_NAME="helmd.tgz"
URL="https://github.com/$REPO/releases/latest/download/$TGZ_NAME"
echo "  fetching latest $TGZ_NAME from $REPO (latest/download)"
curl -fsSL "${AUTH[@]}" -L -o "$CACHE_DIR/$TGZ_NAME" "$URL"

echo "[2/4] installing helmd from local tarball ..."
PROFILE_PKG="$DSH_HOME/profiles/$PROFILE/package.json"
if [ -f "$PROFILE_PKG" ]; then
  echo "  stripping stale deps from existing profile"
  node -e '
const fs=require("fs");
const p=process.argv[1];
const pkg=JSON.parse(fs.readFileSync(p,"utf8"));
const stale=new Set(["dsh-find-plugin","@deepseek-ai/dsh-plugin-console"]);
const isStale=(n)=>stale.has(n)||n.startsWith("@linxin666/")||(n.startsWith("@dsh-security/")&&n!=="@dsh-security/helmd");
let changed=false;
for(const f of ["dependencies","devDependencies","optionalDependencies"]){if(pkg[f]&&typeof pkg[f]==="object"){for(const k of Object.keys(pkg[f])){if(isStale(k)){delete pkg[f][k];changed=true;}}}}
if(changed)fs.writeFileSync(p,JSON.stringify(pkg,null,2)+"\n");
' "$PROFILE_PKG"
fi

TGZ_FILE="$CACHE_DIR/$TGZ_NAME"
if command -v dsh >/dev/null 2>&1; then
  dsh plugin --profile "$PROFILE" add "$TGZ_FILE"
else
  npx --yes @deepseek-ai/dsh plugin --profile "$PROFILE" add "$TGZ_FILE"
fi

# uninstall legacy sibling bundles left in node_modules (incl. pnpm tmp dirs)
SEC_DIR="$DSH_HOME/profiles/$PROFILE/node_modules/@dsh-security"
if [ -d "$SEC_DIR" ]; then
  for d in "$SEC_DIR"/*/; do
    b=$(basename "$d")
    if [ "$b" != "helmd" ]; then rm -rf "$d"; echo "  uninstalled legacy bundle: $b"; fi
  done
fi

echo "[3/4] writing preset ..."
PRESET_DIR="$DSH_HOME/.agent-presets/$PRESET"
mkdir -p "$PRESET_DIR"

BUNDLE_ROOT="$DSH_HOME/profiles/$PROFILE/node_modules/@dsh-security/helmd"
BUNDLE_PRESETS="$BUNDLE_ROOT/presets"
if [ ! -f "$BUNDLE_PRESETS/agent.cordis.yml" ]; then
  echo "bundle presets not found at $BUNDLE_PRESETS"; exit 1
fi

# Regenerate on THIS machine from the installed dsh host's own standard preset
# so platform rows match the local host version; fall back to the shipped
# snapshot when generation cannot run (no node / dsh not installed via npm).
GEN_SCRIPT="$BUNDLE_ROOT/scripts/gen-preset.mjs"
GENERATED=false
if command -v node >/dev/null 2>&1 && [ -f "$GEN_SCRIPT" ]; then
  if node "$GEN_SCRIPT" --out "$PRESET_DIR" && [ -f "$PRESET_DIR/agent.cordis.yml" ]; then
    GENERATED=true
    echo "  preset regenerated from local dsh standard (platform rows match this host)"
  else
    echo "  (generator failed; falling back to shipped snapshot)"
  fi
fi
if [ "$GENERATED" != "true" ]; then
  cp "$BUNDLE_PRESETS/agent.cordis.yml" "$PRESET_DIR/agent.cordis.yml"
  echo "  preset copied from bundle snapshot"
fi
cp "$BUNDLE_PRESETS/preset.yml" "$PRESET_DIR/preset.yml"

echo "[4/4] preset written: $PRESET (default NOT auto-set; pick 'helmd' in the UI preset picker)"
echo
if curl -fsS --max-time 3 "https://127.0.0.1:3080/" >/dev/null 2>&1; then
  echo "NOTE: dsh looks running locally — restart it so the preset standing mount"
  echo "rebuilds from this file (see docs/incident-2026-08-26-preset-stale-generation.md)."
  echo
fi
echo "done. run: dsh $PROFILE   (or: npx --yes @deepseek-ai/dsh $PROFILE)"
echo "then send the activation word: $PRESET"
