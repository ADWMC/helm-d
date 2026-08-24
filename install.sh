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
API_URL="https://api.github.com/repos/$REPO/releases/latest"
AUTH=()
[ -n "${GH_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GH_TOKEN")
if [ -z "${GH_TOKEN:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
  AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi

TGZ_NAME=""
TAG=""
if curl -fsSL -H "Accept: application/vnd.github+json" "${AUTH[@]}" "$API_URL" -o "$TMPDIR/release.json"; then
  TAG=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{console.log(JSON.parse(d).tag_name||"")})' < "$TMPDIR/release.json")
  TGZ_NAME=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d).assets||[];const t=a.find(x=>x.name&&x.name.endsWith(".tgz"));console.log(t?t.name:"")})' < "$TMPDIR/release.json")
fi

if [ -z "$TAG" ] || [ -z "$TGZ_NAME" ]; then
  TAG="v0.1.2"
  TGZ_NAME="dsh-security-helmd-0.1.2.tgz"
  echo "  falling back to pinned release $TAG"
fi

URL="https://github.com/$REPO/releases/download/$TAG/$TGZ_NAME"
echo "  fetching $TGZ_NAME"
curl -fsSL -o "$CACHE_DIR/$TGZ_NAME" "$URL"

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
