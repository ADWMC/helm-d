param(
    [string]$Profile = "web"
)
$ErrorActionPreference = "Stop"

$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$Preset = "helmd"
$Repo = "ADWMC/helm-d"

Write-Host "[1/4] downloading latest release tarball from $Repo ..."
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("helmd-" + [Guid]::NewGuid().ToString("N"))
$cacheDir = Join-Path $DSH_HOME ".tgz-cache"
New-Item -ItemType Directory -Force $tmp | Out-Null
New-Item -ItemType Directory -Force $cacheDir | Out-Null
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $headers = @{ "User-Agent" = "helmd-installer" }
    $ghToken = if ($env:GH_TOKEN) { $env:GH_TOKEN } elseif ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN }
    if ($ghToken) { $headers["Authorization"] = "Bearer $ghToken" }

    # latest/download stable URL: 恒指向最新 release，无需查 API，无版本回退点
    $tgzName = "helmd.tgz"
    $url = "https://github.com/$Repo/releases/latest/download/$tgzName"
    Write-Host "  fetching latest $tgzName from $Repo (latest/download)"
    Invoke-WebRequest -Uri $url -OutFile (Join-Path $cacheDir $tgzName) -UseBasicParsing -MaximumRedirection 5

    Write-Host "[2/4] installing helmd from local tarball ..."
    $profilePkg = Join-Path $DSH_HOME ("profiles\" + $Profile + "\package.json")
    if (Test-Path -LiteralPath $profilePkg) {
        Write-Host "  stripping stale @dsh-security deps from existing profile"
        $stripScript = @'
const fs = require("fs");
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
const stale = new Set(["dsh-find-plugin", "@deepseek-ai/dsh-plugin-console"]);
const isStale = (name) => stale.has(name) || name.startsWith("@linxin666/") ||
  (name.startsWith("@dsh-security/") && name !== "@dsh-security/helmd");
let changed = false;
for (const f of ["dependencies", "devDependencies", "optionalDependencies"]) {
  if (pkg[f] && typeof pkg[f] === "object") {
    for (const k of Object.keys(pkg[f])) {
      if (isStale(k)) { delete pkg[f][k]; changed = true; }
    }
  }
}
if (changed) fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
'@
        $stripFile = Join-Path $tmp "strip-stale.cjs"
        Set-Content -LiteralPath $stripFile -Value $stripScript -Encoding UTF8
        try {
            if (Get-Command node -ErrorAction SilentlyContinue) {
                & node $stripFile $profilePkg
            } else {
                Write-Host "  (node not found; skipped stale-dep strip)"
            }
        } catch {
            Write-Host "  (stale-dep strip skipped: $($_.Exception.Message))"
        }
    }

    $tgzFile = Join-Path $cacheDir $tgzName
    if (Get-Command dsh -ErrorAction SilentlyContinue) {
        & dsh plugin --profile $Profile add $tgzFile
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        & npx --yes @deepseek-ai/dsh plugin --profile $Profile add $tgzFile
    } else {
        throw "Neither `dsh` nor `npx` was found on PATH. Install Node.js (npx) or run `npm i -g @deepseek-ai/dsh`."
    }
    if ($LASTEXITCODE -ne 0) { throw "plugin add failed (exit $LASTEXITCODE)" }

    # uninstall legacy sibling bundles left in node_modules (incl. pnpm tmp dirs)
    $secDir = Join-Path $DSH_HOME ("profiles\" + $Profile + "\node_modules\@dsh-security")
    if (Test-Path $secDir) {
        Get-ChildItem $secDir -Directory | Where-Object { $_.Name -ne "helmd" } | ForEach-Object {
            Remove-Item $_.FullName -Recurse -Force
            Write-Host ("  uninstalled legacy bundle: " + $_.Name)
        }
    }

    Write-Host "[3/4] writing preset ..."
    $presetRoot = Join-Path $DSH_HOME ".agent-presets"
    New-Item -ItemType Directory -Force $presetRoot | Out-Null
    $presetDir = Join-Path $presetRoot $Preset
    New-Item -ItemType Directory -Force $presetDir | Out-Null

    $bundleRoot = Join-Path $DSH_HOME ("profiles\" + $Profile + "\node_modules\@dsh-security\helmd")
    $bundlePresets = Join-Path $bundleRoot "presets"
    if (-not (Test-Path (Join-Path $bundlePresets "agent.cordis.yml"))) { throw "bundle presets not found at $bundlePresets" }

    # Regenerate on THIS machine from the installed dsh host's own standard
    # preset, so the platform rows always match the local host version. Falls
    # back to the shipped snapshot when the generator cannot run (e.g. no node
    # or dsh not installed via npm) — a checked-in copy beats no preset.
    $genScript = Join-Path $bundleRoot "scripts\gen-preset.mjs"
    $generated = $false
    if (Get-Command node -ErrorAction SilentlyContinue) {
        & node $genScript --out $presetDir 2>&1 | ForEach-Object { Write-Host ("    " + $_) }
        if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $presetDir "agent.cordis.yml"))) {
            $generated = $true
            Write-Host "  preset regenerated from local dsh standard (platform rows match this host)"
        } else {
            Write-Host "  (generator failed with exit $LASTEXITCODE; falling back to shipped snapshot)"
        }
    }
    if (-not $generated) {
        Copy-Item (Join-Path $bundlePresets "agent.cordis.yml") (Join-Path $presetDir "agent.cordis.yml") -Force
        Write-Host "  preset copied from bundle snapshot"
    }
    Copy-Item (Join-Path $bundlePresets "preset.yml") (Join-Path $presetDir "preset.yml") -Force

    Write-Host "[4/4] preset written: $Preset (default NOT auto-set; pick 'helmd' in the UI preset picker)"
    Write-Host ""
    Write-Host "NOTE: if dsh is currently running, restart it so the preset standing"
    Write-Host "mount rebuilds from this file (see docs/incident-2026-08-26-preset-stale-generation.md)."
    Write-Host ""
    Write-Host "done. run: dsh $Profile   (or: npx --yes @deepseek-ai/dsh $Profile)"
    Write-Host "then send the activation word: $Preset"
}
finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
