# scripts/setup-preset.ps1 -- re-derive this package's preset patch against the
# dsh host installed on THIS machine.
#
# dsh >= 0.1.7 changed the model: a preset is one composition row
# (@deepseek-ai/dsh-agent-preset) that the bundle declares through
# dsh.bundle.patch, so there is no `.agent-presets/<name>/` deployment left and
# nothing to copy. The artifact lives inside the package
# (preset.generated.patch.yml); this script only regenerates it from the local
# host's own standard preset, which is what a host upgrade requires.
#
# Usage: .\scripts\setup-preset.ps1

$ErrorActionPreference = "Stop"

$pkg = Join-Path $PSScriptRoot ".."
$target = Join-Path $pkg "preset.generated.patch.yml"
$gen = Join-Path $PSScriptRoot "gen-preset.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node is required to regenerate the preset patch (gen-preset.mjs reads the installed dsh standard)"
}
if (-not (Test-Path $gen)) { throw "generator not found at $gen (run from inside the installed package)" }

if (Test-Path $target) {
    Copy-Item $target "$target.bak" -Force
    Write-Host "  kept $target.bak"
}

# gen-preset asserts the artifact's shape and writes nothing when the host
# predates 0.1.7 or the assertion fails, so a non-zero exit leaves the current
# patch untouched.
& node $gen --out $target 2>&1 | ForEach-Object { Write-Host ("    " + $_) }
if ($LASTEXITCODE -ne 0) { throw "gen-preset failed (exit $LASTEXITCODE); $target was left as-is" }

Write-Host "[done] preset patch re-derived from the installed dsh standard"
Write-Host "[next] restart dsh, then assert the first request's tool catalog (MAINTENANCE section 8)"
