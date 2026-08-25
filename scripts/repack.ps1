$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo "dist-tgz"
if (Test-Path $out) { Remove-Item -LiteralPath $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

# Preset single-source sync: presets/full-reverse/ is the ONLY place humans
# edit persona/preset; repack mirrors it into the package so every consumer
# (installer, setup-preset, store tarball) ships byte-identical files.
$presetSrc = Join-Path $repo "presets\full-reverse"
$presetDst = Join-Path $repo "packages\helmd\presets"
foreach ($f in @("preset.yml", "agent.cordis.yml")) {
    $s = Join-Path $presetSrc $f
    if (-not (Test-Path $s)) { throw "missing preset source: $s" }
    New-Item -ItemType Directory -Force $presetDst | Out-Null
    Copy-Item $s (Join-Path $presetDst $f) -Force
}
Write-Output "presets synced: full-reverse -> packages/helmd/presets"

# Single unified bundle. The unversioned copy keeps the stable download URL
# https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz working
# across releases (used by installers and the awesome-dsh-plugin listing).
$pkgs = @("helmd")
foreach ($p in $pkgs) {
    $dir = Join-Path $repo ("packages\" + $p)
    Push-Location $dir
    try {
        $line = cmd /c "npm pack --pack-destination `"$out`" 2>&1"
        Write-Output ("{0} -> {1}" -f $p, ($line | Select-Object -Last 1))
    }
    finally {
        Pop-Location
    }
}

# Stable-name alias for the latest release asset.
$versioned = Get-ChildItem -LiteralPath $out -Filter "dsh-security-helmd-*.tgz" | Select-Object -First 1
if ($versioned) {
    Copy-Item -LiteralPath $versioned.FullName (Join-Path $out "helmd.tgz") -Force
}

Write-Output "--- packed ---"
Get-ChildItem -LiteralPath $out -Filter "*.tgz" | ForEach-Object {
    Write-Output ("{0}  {1}" -f $_.Name, $_.Length)
}
