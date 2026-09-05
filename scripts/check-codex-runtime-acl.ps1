$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targets = @(
  (Join-Path $workspace '.codex'),
  (Join-Path $workspace '.tmp'),
  (Join-Path $workspace '.pnpm-store'),
  (Join-Path $workspace 'AGENTS.md'),
  (Join-Path $workspace 'SAFE-BASELINE.md')
)

$failed = $false
foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath $target)) { continue }
  $owner = (Get-Acl -LiteralPath $target).Owner
  $stale = $owner -match 'CodexSandboxOffline|CodexSandboxUsers'
  [pscustomobject]@{
    Path = $target
    Owner = $owner
    Status = if ($stale) { 'STALE_SANDBOX_OWNER' } else { 'OK' }
  }
  if ($stale) { $failed = $true }
}

if ($failed) {
  Write-Error 'Codex runtime ACL owner mismatch detected. See docs/CODEX-RUNTIME-ACL-RECOVERY.md.'
  exit 1
}

Write-Host 'Codex runtime ACL owner check: PASS'
