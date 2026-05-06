# SAN/CMP pilot generation orchestrator.
#
# Generates lessons + practice for all 207 SAN/CMP topics across classes
# 6, 7, 8 (BSE Odisha). Idempotent — re-running skips topics that already
# have all 4 lesson variants / 8 practice items.
#
# Phases:
#   L6: lessons C6 SAN + CMP
#   L7: lessons C7 SAN + CMP
#   L8: lessons C8 SAN
#   P6: practice C6 SAN + CMP
#   P7: practice C7 SAN + CMP
#   P8: practice C8 SAN
[CmdletBinding()]
param(
    [switch]$SkipLessons,
    [switch]$SkipPractice,
    [switch]$Force
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$logDir = Join-Path $PSScriptRoot "..\..\data\reports\san-cmp-runs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$summary = Join-Path $logDir "$stamp-summary.log"

function Run-Gen {
    param(
        [string]$Phase,
        [string]$Kind,
        [int]$ClassLevel,
        [string]$Subjects,
        [switch]$ForceRegen
    )
    $script = if ($Kind -eq "lessons") { "scripts/content/generate-lessons.ts" } else { "scripts/content/generate-practice.ts" }
    $log = Join-Path $logDir "$stamp-$Phase-c$ClassLevel-$($Subjects -replace ',','_')-$Kind.log"
    Write-Host ""
    Write-Host "==> [$Phase][$Kind] class=$ClassLevel subject=$Subjects force=$ForceRegen" -ForegroundColor Cyan
    $args = @("tsx", $script, "--class", "$ClassLevel", "--board", "BSE_ODISHA", "--subject", $Subjects)
    if ($ForceRegen) { $args += "--force" }
    & npx @args *>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! [$Phase][$Kind] c$ClassLevel $Subjects exited with $LASTEXITCODE" -ForegroundColor Yellow
        Add-Content $summary "FAIL [$Phase][$Kind] c$ClassLevel $Subjects exit=$LASTEXITCODE log=$log"
    } else {
        Add-Content $summary "OK   [$Phase][$Kind] c$ClassLevel $Subjects log=$log"
    }
}

Add-Content $summary "Run started: $(Get-Date -Format o)"
Add-Content $summary "SkipLessons=$SkipLessons SkipPractice=$SkipPractice Force=$Force"

if (-not $SkipLessons) {
    Write-Host "`n========== LESSONS ==========" -ForegroundColor Magenta
    Run-Gen -Phase "L6" -Kind "lessons" -ClassLevel 6 -Subjects "SAN,CMP" -ForceRegen:$Force
    Run-Gen -Phase "L7" -Kind "lessons" -ClassLevel 7 -Subjects "SAN,CMP" -ForceRegen:$Force
    Run-Gen -Phase "L8" -Kind "lessons" -ClassLevel 8 -Subjects "SAN"     -ForceRegen:$Force
}

if (-not $SkipPractice) {
    Write-Host "`n========== PRACTICE ==========" -ForegroundColor Magenta
    Run-Gen -Phase "P6" -Kind "practice" -ClassLevel 6 -Subjects "SAN,CMP" -ForceRegen:$Force
    Run-Gen -Phase "P7" -Kind "practice" -ClassLevel 7 -Subjects "SAN,CMP" -ForceRegen:$Force
    Run-Gen -Phase "P8" -Kind "practice" -ClassLevel 8 -Subjects "SAN"     -ForceRegen:$Force
}

Add-Content $summary "Run finished: $(Get-Date -Format o)"
Write-Host ""
Write-Host "All phases complete. Summary: $summary" -ForegroundColor Green
