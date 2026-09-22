#!/usr/bin/env bash
# One-command deploy for helmd: download the latest release tarball, write the
# preset inline, and set it as the default agent preset.
set -euo pipefail

PROFILE="${1:-web}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
ACTIVATION="helmd"
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
const isStale=(n)=>stale.has(n)||n.startsWith("@linxin666/")||(n.startsWith("@dsh-security/")&&n!=="@adwmc/helm-d");
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
    rm -rf "$d"; echo "  uninstalled legacy bundle: $b"
  done
fi

echo "[3/4] deriving the preset patch against this machine's dsh host ..."
BUNDLE_ROOT="$DSH_HOME/profiles/$PROFILE/node_modules/@adwmc/helm-d"
BUNDLE_PRESETS="$BUNDLE_ROOT/presets"
PATCH_TARGET="$BUNDLE_ROOT/preset.generated.patch.yml"
if [ ! -f "$PATCH_TARGET" ]; then
  echo "bundled preset patch not found at $PATCH_TARGET"; exit 1
fi
if [ ! -f "$BUNDLE_PRESETS/persona.txt" ]; then
  echo "bundle persona source not found at $BUNDLE_PRESETS"; exit 1
fi

# dsh >= 0.1.7 loads the preset straight from the bundle through
# dsh.bundle.patch, so there is nothing to deploy. The release ships a patch
# generated against the release build's host; re-derive it HERE so the platform
# rows match the dsh actually installed on this machine. gen-preset writes
# nothing when it cannot read a 0.1.7 host standard, so the fallback is simply
# keeping the shipped patch (correct rows for the release's version).
GEN_SCRIPT="$BUNDLE_ROOT/scripts/gen-preset.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$GEN_SCRIPT" ]; then
  if node "$GEN_SCRIPT" --out "$PATCH_TARGET"; then
    echo "  preset patch re-derived from local dsh standard (platform rows match this host)"
  else
    echo "  (generator failed; keeping the shipped patch - run scripts/setup-preset.sh after upgrading dsh)"
  fi
else
  echo "  (node or generator unavailable; keeping the shipped patch - run scripts/setup-preset.sh once node is on PATH)"
fi

echo "[4/4] preset ready: id 'helmd' (default NOT auto-set; pick 'helmd' in the UI preset picker)"
echo
# dsh >= 0.1.7 serves plain http on loopback, and an unauthenticated request
# answers 401 — which still proves something is listening, so no -f here.
if curl -sS --max-time 3 -o /dev/null "http://127.0.0.1:3080/" 2>/dev/null; then
  echo "NOTE: dsh looks running locally — restart it so it re-reads the preset patch"
  echo "from this package (see docs/incident-2026-08-26-preset-stale-generation.md)."
  echo
fi
echo "done. run: dsh $PROFILE   (or: npx --yes @deepseek-ai/dsh $PROFILE)"
echo "then send the activation word: $ACTIVATION"
