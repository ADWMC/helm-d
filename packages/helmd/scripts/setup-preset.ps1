# scripts/setup-preset.ps1 -- write the helmd agent preset from the files
# shipped inside this bundle. Run after ANY install method (store, URL, local
# tarball) to get the full persona + tool configuration.
#
# Usage: .\scripts\setup-preset.ps1 [-Preset helmd]

param(
    [string]$Preset = "helmd"
)
$ErrorActionPreference = "Stop"

$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }

$src = Join-Path $PSScriptRoot "..\presets"
if (-not (Test-Path (Join-Path $src "agent.cordis.yml"))) {
    throw "preset templates not found at $src (run from inside the installed package)"
}

$presetDir = Join-Path $DSH_HOME ".agent-presets\$Preset"
New-Item -ItemType Directory -Force $presetDir | Out-Null

foreach ($f in @("preset.yml", "agent.cordis.yml")) {
    $dstFile = Join-Path $presetDir $f
    $suffix = ""
    if (Test-Path $dstFile) { Copy-Item $dstFile "$dstFile.bak" -Force; $suffix = "  (.bak kept)" }
    Copy-Item (Join-Path $src $f) $dstFile -Force
    Write-Host ("  wrote " + $f + $suffix)
}
Write-Host "[done] preset '$Preset' written to $presetDir"
Write-Host "pick '$Preset' in the UI preset picker when starting a session."
