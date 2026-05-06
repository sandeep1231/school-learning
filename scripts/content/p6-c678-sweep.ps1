# P6 full sweep — Classes 6/7/8 lessons + practice for FLO/GSC/MTH/SLE/SSC/TLH.
#
# Phases run sequentially. Each invocation is idempotent (skips topics
# with all 4 lesson variants / 8 practice items already present).
#
# Total topics: ~930 (C6:350 + C7:215 + C8:365)
# Expected: ~3,720 lesson variants + ~7,440 practice items.
#
# Logs: data/reports/p6-runs/<stamp>-<phase>-cN-SUBJ-KIND.log
[CmdletBinding()]
param(
    [int[]]$Classes = @(6, 7, 8),
    [string[]]$Subjects = @("FLO","GSC","MTH","SLE","SSC","TLH"),
    [switch]$SkipLessons,
    [switch]$SkipPractice,
    [int]$MaxCalls = 0,     # 0 = no cap
    [int]$MaxTokens = 0     # 0 = no cap
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$logDir = Join-Path $PSScriptRoot "..\..\data\reports\p6-runs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$summary = Join-Path $logDir "$stamp-summary.log"

function Run-Gen {
    param(
        [string]$Phase,
        [string]$Kind,
        [int]$ClassLevel,
        [string]$Subject
    )
    $script = if ($Kind -eq "lessons") { "scripts/content/generate-lessons.ts" } else { "scripts/content/generate-practice.ts" }
    $log = Join-Path $logDir "$stamp-$Phase-c$ClassLevel-$Subject-$Kind.log"
    Write-Host ""
    Write-Host "==> [$Phase][$Kind] class=$ClassLevel subject=$Subject" -ForegroundColor Cyan
    $args = @("tsx", $script, "--class", "$ClassLevel", "--board", "BSE_ODISHA", "--subject", $Subject)
    if ($MaxCalls -gt 0)  { $args += @("--max-calls", "$MaxCalls") }
    if ($MaxTokens -gt 0) { $args += @("--max-tokens", "$MaxTokens") }
    & npx @args *>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! [$Phase][$Kind] c$ClassLevel $Subject exited with $LASTEXITCODE" -ForegroundColor Yellow
        Add-Content $summary "FAIL [$Phase][$Kind] c$ClassLevel $Subject exit=$LASTEXITCODE log=$log"
    } else {
        Add-Content $summary "OK   [$Phase][$Kind] c$ClassLevel $Subject log=$log"
    }
}

Add-Content $summary "Run started: $(Get-Date -Format o)"
Add-Content $summary "Classes=$($Classes -join ',') Subjects=$($Subjects -join ',') SkipLessons=$SkipLessons SkipPractice=$SkipPractice MaxCalls=$MaxCalls MaxTokens=$MaxTokens"

if (-not $SkipLessons) {
    Write-Host "`n========== LESSONS ==========" -ForegroundColor Magenta
    foreach ($cl in $Classes) {
        foreach ($s in $Subjects) {
            Run-Gen -Phase "L" -Kind "lessons" -ClassLevel $cl -Subject $s
        }
    }
}

if (-not $SkipPractice) {
    Write-Host "`n========== PRACTICE ==========" -ForegroundColor Magenta
    foreach ($cl in $Classes) {
        foreach ($s in $Subjects) {
            Run-Gen -Phase "P" -Kind "practice" -ClassLevel $cl -Subject $s
        }
    }
}

Add-Content $summary "Run finished: $(Get-Date -Format o)"
Write-Host ""
Write-Host "All phases complete. Summary: $summary" -ForegroundColor Green
