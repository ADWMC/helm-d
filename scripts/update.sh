#!/usr/bin/env bash
# scripts/update.sh -- self-update the installed @dsh-security/helmd bundle.
# Compares the profile's installed version against the latest GitHub release;
# if newer, downloads the prebuilt tarball and reinstalls into the profile.
#
# Usage:
#   ./scripts/update.sh                    # update profile "web" if newer exists
#   PROFILE=headless ./scripts/update.sh
#   ./scripts/update.sh --check            # print versions, change nothing
#   ./scripts/update.sh --force            # reinstall even when versions match

set -euo pipefail

PROFILE="${PROFILE:-web}"
CHECK=0; FORCE=0; DOWN=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    --force) FORCE=1 ;;
    --allow-downgrade) DOWN=1 ;;
    *) echo "unknown arg: $arg"; exit 2 ;;
  esac
done

REPO="ADWMC/helm-d"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PKG="$DSH_HOME/profiles/$PROFILE/node_modules/@dsh-security/helmd/package.json"

installed=""
[ -f "$PKG" ] && installed=$(node -p "require('$PKG').version" 2>/dev/null || true)

# Uninstall everything @dsh-security/* except the unified helmd bundle:
# strips stale dependency entries AND deletes their node_modules dirs.
remove_legacy_bundles() {
  prof="$DSH_HOME/profiles/$PROFILE"
  pkgf="$prof/package.json"
  if [ -f "$pkgf" ] && command -v node >/dev/null 2>&1; then
    out=$(node -e '
const fs=require("fs");
const p=process.argv[1];
const pkg=JSON.parse(fs.readFileSync(p,"utf8"));
let changed=false;
for(const sec of ["dependencies","devDependencies","optionalDependencies"]){const m=pkg[sec];if(!m||typeof m!=="object")continue;for(const k of Object.keys(m)){if(k.startsWith("@dsh-security/")&&k!=="@dsh-security/helmd"){delete m[k];changed=true;}}}
if(changed)fs.writeFileSync(p,JSON.stringify(pkg,null,2)+"\n");
console.log(changed?"deps-stripped":"deps-clean");
' "$pkgf" 2>/dev/null || true)
    echo "  [deps] ${out:-skipped}"
  fi
  secdir="$prof/node_modules/@dsh-security"
  if [ -d "$secdir" ]; then
    for d in "$secdir"/*/; do
      b=$(basename "$d")
      if [ "$b" != "helmd" ]; then rm -rf "$d"; echo "  [removed] $b"; fi
    done
  fi
}

AUTH=()
[ -n "${GH_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GH_TOKEN")
latest_tag=$(curl -fsSL -H "User-Agent: helmd-updater" "${AUTH[@]:-}" \
  "https://api.github.com/repos/$REPO/releases/latest" | node -e \
  'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).tag_name||""))')
latest="${latest_tag#v}"

echo "installed : ${installed:-not installed}"
echo "latest    : $latest ($latest_tag)"

# always sweep legacy bundles, even on the check/up-to-date paths
remove_legacy_bundles

[ "$CHECK" = "1" ] && exit 0

newer=false
if [ -z "$installed" ]; then newer=true
else
  newer=$(printf '%s\n%s\n' "$installed" "$latest" | sort -V | tail -n1)
  [ "$newer" != "$installed" ] && newer=true || newer=false
fi

if [ "$newer" != "true" ] && [ "$FORCE" != "1" ]; then
  echo "[OK] already up to date."
  exit 0
fi

# never silently downgrade: a local/dev build can be newer than the last release
if [ -n "$installed" ] && [ "$DOWN" != "1" ]; then
  older=$(printf '%s\n%s\n' "$latest" "$installed" | sort -V | tail -n1)
  if [ "$older" = "$installed" ] && [ "$latest" != "$installed" ]; then
    echo "[!] installed $installed is NEWER than latest release $latest (local build?)."
    echo "    refusing to downgrade. Publish a new release or pass --allow-downgrade."
    exit 1
  fi
fi

name="dsh-security-helmd-$latest.tgz"
url="https://github.com/$REPO/releases/download/$latest_tag/$name"
cache="$DSH_HOME/.tgz-cache"
mkdir -p "$cache"
tgz="$cache/$name"

echo "[1/2] downloading $name ..."
curl -fsSL -o "$tgz" "$url"

echo "[2/2] installing into profile '$PROFILE' ..."
if command -v dsh >/dev/null 2>&1; then
  dsh plugin --profile "$PROFILE" add "$tgz"
else
  npx --yes @deepseek-ai/dsh plugin --profile "$PROFILE" add "$tgz"
fi

sec="$DSH_HOME/profiles/$PROFILE/node_modules/@dsh-security"
if [ -d "$sec" ]; then
  for d in "$sec"/*/; do
    b=$(basename "$d")
    if [ "$b" != "helmd" ]; then rm -rf "$d"; echo "  [CLEAN] $b"; fi
  done
fi

# pnpm's atomic swap can leave tmp dirs behind; sweep once more post-install
remove_legacy_bundles

echo "[done] @dsh-security/helmd -> $latest"
