param(
    [string]$Profile = "web"
)
$ErrorActionPreference = "Stop"

$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$Preset = "helmd"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path

$pkgs = @(
    "@dsh-security/bootstrap",
    "@dsh-security/router",
    "@dsh-security/skill-android",
    "@dsh-security/skill-web",
    "@dsh-security/skill-native",
    "@dsh-security/skill-protocol",
    "@dsh-security/skill-malware",
    "@dsh-security/skill-ai-security",
    "@dsh-security/skill-evidence"
)

Write-Host "[1/3] installing @dsh-security/* into profile '$Profile' ..."
dsh plugin --profile $Profile add @pkgs

$presetDir = Join-Path $DSH_HOME ".agent-presets\$Preset"
Write-Host "[2/3] mounting preset to $presetDir"
New-Item -ItemType Directory -Force $presetDir | Out-Null
Copy-Item (Join-Path $Here "presets\full-reverse\agent.cordis.yml") $presetDir -Force
Copy-Item (Join-Path $Here "presets\full-reverse\preset.yml") $presetDir -Force

Write-Host "[3/3] setting default preset ..."
$settings = Join-Path $DSH_HOME "settings.yaml"
New-Item -ItemType Directory -Force $DSH_HOME | Out-Null
if (-not (Test-Path -LiteralPath $settings)) {
    Set-Content -LiteralPath $settings -Value "agent-presets:`n  default: $Preset`n" -NoNewline -Encoding UTF8
} else {
    $lines = Get-Content -LiteralPath $settings
    $out = New-Object System.Collections.Generic.List[string]
    $inAp = $false
    $done = $false
    $sawAp = $false
    foreach ($line in $lines) {
        if ($line -match '^agent-presets:') {
            $inAp = $true
            $sawAp = $true
            $out.Add($line)
            continue
        }
        if ($inAp -and -not $done -and $line -match '^\s*default:') {
            $out.Add("  default: $Preset")
            $done = $true
            continue
        }
        if ($inAp -and -not $done -and $line -match '^\s*[A-Za-z_][A-Za-z0-9_-]*:') {
            $out.Add("  default: $Preset")
            $done = $true
            $out.Add($line)
            continue
        }
        $out.Add($line)
    }
    if (-not $sawAp) {
        $out.Add("agent-presets:")
        $out.Add("  default: $Preset")
    }
    Set-Content -LiteralPath $settings -Value $out -NoNewline -Encoding UTF8
}

Write-Host ""
Write-Host "done. run: dsh $Profile   (or: dsh web)"
Write-Host "then send the activation word: $Preset"
