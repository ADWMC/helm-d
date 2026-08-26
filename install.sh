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
echo "[3/4] writing preset ..."
mkdir -p "$DSH_HOME/.agent-presets/$PRESET"

# copy the authoritative FULL preset shipped inside the bundle
# (single source of truth -- replaces the old condensed inline heredoc)
BUNDLE_PRESETS="$DSH_HOME/profiles/$PROFILE/node_modules/@dsh-security/helmd/presets"
if [ ! -f "$BUNDLE_PRESETS/agent.cordis.yml" ]; then
  echo "bundle presets not found at $BUNDLE_PRESETS"; exit 1
fi
cp "$BUNDLE_PRESETS/preset.yml" "$DSH_HOME/.agent-presets/$PRESET/preset.yml"
cp "$BUNDLE_PRESETS/agent.cordis.yml" "$DSH_HOME/.agent-presets/$PRESET/agent.cordis.yml"
echo "[4/4] preset written: $PRESET (default NOT auto-set; pick 'helmd' in the UI preset picker)"
echo
echo "done. run: dsh $PROFILE   (or: npx --yes @deepseek-ai/dsh $PROFILE)"
echo "then send the activation word: $PRESET"
