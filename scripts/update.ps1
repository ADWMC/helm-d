# scripts/update.ps1 -- self-update the installed @dsh-security/helmd bundle.
# Compares the profile's installed version against the latest GitHub release;
# if newer, downloads the prebuilt tarball and reinstalls into the profile.
#
# Usage:
#   .\scripts\update.ps1                  # update profile "web" if newer exists
#   .\scripts\update.ps1 -Profile headless
#   .\scripts\update.ps1 -CheckOnly       # print versions, change nothing
#   .\scripts\update.ps1 -Force           # reinstall even when versions match

param(
    [string]$Profile = "web",
    [switch]$CheckOnly,
    [switch]$Force,
    [switch]$AllowDowngrade
)
$ErrorActionPreference = "Stop"

$Repo = "ADWMC/helm-d"
$Bundle = "@dsh-security/helmd"
$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }

function Get-InstalledVersion {
    $pkg = Join-Path $DSH_HOME ("profiles\" + $Profile + "\node_modules\@dsh-security\helmd\package.json")
    if (-not (Test-Path -LiteralPath $pkg)) { return $null }
    try { return ((Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json).version) } catch { return $null }
}

function Normalize([string]$v) {
    if (-not $v) { return $null }
    return ($v.TrimStart("v") -replace '\s', '')
}

$installed = Normalize (Get-InstalledVersion)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$headers = @{ "User-Agent" = "helmd-updater" }
$ghToken = if ($env:GH_TOKEN) { $env:GH_TOKEN } elseif ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN }
if ($ghToken) { $headers["Authorization"] = "Bearer $ghToken" }

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers
    $latestTag = $release.tag_name
} catch {
    Write-Host "[!] cannot reach GitHub releases: $($_.Exception.Message)"
    exit 1
}
$latest = Normalize $latestTag

Write-Host ("installed : {0}" -f ($(if ($installed) { "$Bundle $installed" } else { "not installed" })))
Write-Host ("latest    : {0} ({1})" -f $latest, $latestTag)

if ($CheckOnly) { exit 0 }

$newer = $false
if ($installed -and $latest) {
    try   { $newer = ([version]$latest) -gt ([version]$installed) }
    catch { $newer = ($latest -ne $installed) }
} elseif (-not $installed -and $latest) {
    $newer = $true
}

if (-not $newer -and -not $Force) {
    Write-Host "[OK] already up to date."
    exit 0
}

# never silently downgrade: a local/dev build can be newer than the last release
if ($installed -and $latest) {
    $older = $false
    try   { $older = ([version]$latest) -lt ([version]$installed) } catch { }
    if ($older -and -not $AllowDowngrade) {
        Write-Host "[!] installed $installed is NEWER than latest release $latest (local build?)."
        Write-Host "    refusing to downgrade. Publish a new release or pass -AllowDowngrade."
        exit 1
    }
}

$name = "dsh-security-helmd-$latest.tgz"
$url = "https://github.com/$Repo/releases/download/$latestTag/$name"
$cacheDir = Join-Path $DSH_HOME ".tgz-cache"
New-Item -ItemType Directory -Force $cacheDir | Out-Null
$tgz = Join-Path $cacheDir $name

Write-Host "[1/2] downloading $name ..."
Invoke-WebRequest -Uri $url -OutFile $tgz -UseBasicParsing

Write-Host "[2/2] installing into profile '$Profile' ..."
if (Get-Command dsh -ErrorAction SilentlyContinue) {
    & dsh plugin --profile $Profile add $tgz
} else {
    & npx --yes @deepseek-ai/dsh plugin --profile $Profile add $tgz
}
if ($LASTEXITCODE -ne 0) { throw "plugin add failed (exit $LASTEXITCODE)" }

# drop legacy sibling bundles re-introduced by dependency resolution
$sec = Join-Path $DSH_HOME ("profiles\" + $Profile + "\node_modules\@dsh-security")
if (Test-Path $sec) {
    Get-ChildItem $sec -Directory | Where-Object { $_.Name -ne "helmd" } | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force
        Write-Host ("  [CLEAN] " + $_.Name)
    }
}

Write-Host "[done] $Bundle -> $latest"
