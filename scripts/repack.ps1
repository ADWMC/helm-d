$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo "dist-tgz"
if (Test-Path $out) { Remove-Item -LiteralPath $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

$pkgs = @("bootstrap", "router", "skill-ai-security", "skill-android", "skill-evidence", "skill-malware", "skill-native", "skill-protocol", "skill-web", "toolbox")
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

Write-Output "--- packed ---"
Get-ChildItem -LiteralPath $out -Filter "*.tgz" | ForEach-Object {
    Write-Output ("{0}  {1}" -f $_.Name, $_.Length)
}
