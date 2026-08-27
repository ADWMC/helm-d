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

# Regenerate against the LOCAL host inside this run: the platform rows must
# match the installed dsh, not the release snapshot. Fall back to snapshot
# when node or the generator is unavailable.
$genScript = Join-Path $PSScriptRoot "gen-preset.mjs"
$generated = $false
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand -and (Test-Path $genScript)) {
    & node $genScript --out $presetDir 2>&1 | ForEach-Object { Write-Host ("    " + $_) }
    if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $presetDir "agent.cordis.yml"))) {
        $generated = $true
        Write-Host "[gen] preset regenerated from local dsh standard (match this host)"
    } else {
        Write-Host ("[gen] generator failed with exit $LASTEXITCODE; falling back to snapshot")
    }
}

foreach ($f in @("preset.yml", "agent.cordis.yml")) {
    $dstFile = Join-Path $presetDir $f
    $suffix = ""
    if (Test-Path $dstFile) { Copy-Item $dstFile "$dstFile.bak" -Force; $suffix = "  (.bak kept)" }
    if ($f -eq "agent.cordis.yml" -and $generated) {
        Write-Host ("  kept generated " + $f + $suffix)
    } else {
        Copy-Item (Join-Path $src $f) $dstFile -Force
        Write-Host ("  wrote " + $f + $suffix)
    }
}
Write-Host "[done] preset '$Preset' written to $presetDir"
Write-Host "NOTE: if dsh is currently running, restart it after a changed preset so its standing mount reloads cleanly."
Write-Host "pick '$Preset' in the UI preset picker when starting a session."
