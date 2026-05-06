# P3 driver: generate lessons + practice for Class 9 BSE Odisha across all
# remaining subjects (FLO/GSC/SLE/TLH for both, plus MTH/SSC top-up for any
# new topics that came in via the seeder). Runs sequentially so we stay
# polite on Gemini rate limits and one failure is easy to spot.
#
# Each step is idempotent: the generators skip topics that already have
# sufficient content. Re-running is safe.
#
# Usage (from repo root):
#   pwsh -File scripts/content/p3-class9.ps1
#   pwsh -File scripts/content/p3-class9.ps1 -OnlyPractice
#   pwsh -File scripts/content/p3-class9.ps1 -Subjects "GSC,SLE"
[CmdletBinding()]
param(
    [string]$Subjects = "FLO,GSC,SLE,TLH,MTH,SSC",
    [switch]$OnlyLessons,
    [switch]$OnlyPractice,
    [switch]$Force
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$logDir = Join-Path $PSScriptRoot "..\..\data\reports\p3-runs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$subjectList = $Subjects.Split(",") | ForEach-Object { $_.Trim().ToUpper() } | Where-Object { $_ }

function Invoke-Gen {
    param([string]$Kind, [string]$Subject)
    $script = if ($Kind -eq "lessons") { "scripts/content/generate-lessons.ts" } else { "scripts/content/generate-practice.ts" }
    $log = Join-Path $logDir "$stamp-$Subject-$Kind.log"
    Write-Host ""
    Write-Host "==> [$Kind] subject=$Subject  log=$log" -ForegroundColor Cyan
    $cmd = @("tsx", $script, "--class", "9", "--board", "BSE_ODISHA", "--subject", $Subject)
    if ($Force) { $cmd += "--force" }
    & npx @cmd *>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! $Kind for $Subject exited with code $LASTEXITCODE" -ForegroundColor Yellow
    }
}

# Lesson pass first across all subjects, then practice pass. Doing it this
# way means a partial run still leaves every subject with *some* lesson
# content before any practice generation begins.
if (-not $OnlyPractice) {
    foreach ($s in $subjectList) { Invoke-Gen -Kind "lessons" -Subject $s }
}
if (-not $OnlyLessons) {
    foreach ($s in $subjectList) { Invoke-Gen -Kind "practice" -Subject $s }
}

Write-Host ""
Write-Host "P3 driver finished. Logs in $logDir" -ForegroundColor Green
