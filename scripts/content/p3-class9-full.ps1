# Full Class 9 regeneration orchestrator.
#
# Phase A: SLE + TLH lessons (--force) — replaces stale `or` rows with the
#          new bilingual `en`/`hi` rows.
# Phase B: SLE + TLH practice (--force) — same reason.
# Phase C: FLO + GSC + MTH + SSC lessons (no force) — fills only missing
#          topics so we don't burn tokens regenerating already-good `or`
#          content. Picks up the new bilingual instruction for any topic
#          that didn't have a variant yet.
# Phase D: FLO + GSC + MTH + SSC practice (no force) — same.
#
# Each phase logs to data/reports/p3-runs/<stamp>-<phase>-<subject>-<kind>.log
# and continues even if a single subject errors. A final audit report is
# written at the end.
[CmdletBinding()]
param(
    [switch]$SkipA,        # skip phase A (SLE+TLH lessons)
    [switch]$SkipB,        # skip phase B (SLE+TLH practice)
    [switch]$SkipC,        # skip phase C (other subjects lessons)
    [switch]$SkipD         # skip phase D (other subjects practice)
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$logDir = Join-Path $PSScriptRoot "..\..\data\reports\p3-runs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$summary = Join-Path $logDir "$stamp-summary.log"

function Run-Gen {
    param([string]$Phase, [string]$Kind, [string]$Subject, [switch]$Force)
    $script = if ($Kind -eq "lessons") { "scripts/content/generate-lessons.ts" } else { "scripts/content/generate-practice.ts" }
    $log = Join-Path $logDir "$stamp-$Phase-$Subject-$Kind.log"
    Write-Host ""
    Write-Host "==> [$Phase][$Kind] subject=$Subject force=$Force" -ForegroundColor Cyan
    $args = @("tsx", $script, "--class", "9", "--board", "BSE_ODISHA", "--subject", $Subject)
    if ($Force) { $args += "--force" }
    & npx @args *>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! [$Phase][$Kind] $Subject exited with code $LASTEXITCODE" -ForegroundColor Yellow
        Add-Content $summary "FAIL [$Phase][$Kind] $Subject exit=$LASTEXITCODE log=$log"
    } else {
        Add-Content $summary "OK   [$Phase][$Kind] $Subject log=$log"
    }
}

Add-Content $summary "Run started: $(Get-Date -Format o)"
Add-Content $summary "SkipA=$SkipA SkipB=$SkipB SkipC=$SkipC SkipD=$SkipD"

if (-not $SkipA) {
    Write-Host "`n========== PHASE A: SLE+TLH lessons --force ==========" -ForegroundColor Magenta
    foreach ($s in "SLE","TLH") { Run-Gen -Phase "A" -Kind "lessons" -Subject $s -Force }
}

if (-not $SkipB) {
    Write-Host "`n========== PHASE B: SLE+TLH practice --force ==========" -ForegroundColor Magenta
    foreach ($s in "SLE","TLH") { Run-Gen -Phase "B" -Kind "practice" -Subject $s -Force }
}

if (-not $SkipC) {
    Write-Host "`n========== PHASE C: FLO+GSC+MTH+SSC lessons (gap fill) ==========" -ForegroundColor Magenta
    foreach ($s in "FLO","GSC","MTH","SSC") { Run-Gen -Phase "C" -Kind "lessons" -Subject $s }
}

if (-not $SkipD) {
    Write-Host "`n========== PHASE D: FLO+GSC+MTH+SSC practice (gap fill) ==========" -ForegroundColor Magenta
    foreach ($s in "FLO","GSC","MTH","SSC") { Run-Gen -Phase "D" -Kind "practice" -Subject $s }
}

Add-Content $summary "Run finished: $(Get-Date -Format o)"
Write-Host ""
Write-Host "All phases complete. Summary: $summary" -ForegroundColor Green
Write-Host "Logs in $logDir" -ForegroundColor Green
