$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo "dist-tgz"
if (Test-Path $out) { Remove-Item -LiteralPath $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

# Preset anti-drift derivation (dsh >= 0.1.7): the preset is ONE composition
# row, so the package ships its own patch file — packages/helmd/
# preset.generated.patch.yml — generated from the installed host's OWN standard
# preset patch and loaded through dsh.bundle.patch. The human-edited sources are
# persona.txt and preset.yml only. Hand-copying produced incident 2026-08-26 —
# never reintroduce a manually authored copy, and never hand-edit the artifact.
Write-Output "generating preset patch from installed dsh standard..."
node (Join-Path $repo "scripts\gen-preset.mjs")
if ($LASTEXITCODE -ne 0) { throw "gen-preset failed (exit $LASTEXITCODE)" }

# Keep the packaged generator byte-identical to the repository source (it is
# what install-time and auto-heal regeneration runs against the local host).
Copy-Item (Join-Path $repo "scripts\gen-preset.mjs") (Join-Path $repo "packages\helmd\scripts\gen-preset.mjs") -Force
Write-Output "generator synced: scripts/gen-preset.mjs -> packages/helmd/scripts/gen-preset.mjs"

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
$versioned = Get-ChildItem -LiteralPath $out -Filter "adwmc-helm-d-*.tgz" | Select-Object -First 1
if ($versioned) {
    Copy-Item -LiteralPath $versioned.FullName (Join-Path $out "helmd.tgz") -Force
}

Write-Output "--- packed ---"
Get-ChildItem -LiteralPath $out -Filter "*.tgz" | ForEach-Object {
    Write-Output ("{0}  {1}" -f $_.Name, $_.Length)
}
