Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$UpstreamRemote = "upstream",
  [string]$UpstreamBranch = "main",
  [string]$BaseBranch = "main",
  [string]$SyncBranch = "sync/upstream-main",
  [switch]$ResetBranch
)

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Get-GitOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $output = & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
  return $output
}

$repoRoot = Get-GitOutput -Args @("rev-parse", "--show-toplevel")
$repoRoot = ($repoRoot | Select-Object -First 1).Trim()
if (-not $repoRoot) {
  throw "Unable to determine git repository root."
}

Push-Location $repoRoot
try {
  $status = Get-GitOutput -Args @("status", "--porcelain")
  if ($status) {
    throw "Working tree is not clean. Commit or stash changes before syncing upstream."
  }

  $upstreamUrl = Get-GitOutput -Args @("remote", "get-url", $UpstreamRemote)
  $upstreamUrl = ($upstreamUrl | Select-Object -First 1).Trim()
  if (-not $upstreamUrl) {
    throw "Remote '$UpstreamRemote' is not configured."
  }

  Write-Host "Fetching $UpstreamRemote/$UpstreamBranch..."
  Invoke-Git -Args @("fetch", $UpstreamRemote)

  $baseExists = $false
  try {
    $null = Get-GitOutput -Args @("show-ref", "--verify", "--quiet", "refs/heads/$BaseBranch")
    $baseExists = $true
  } catch {
    $baseExists = $false
  }

  if (-not $baseExists) {
    throw "Base branch '$BaseBranch' does not exist locally."
  }

  $syncExists = $false
  try {
    $null = Get-GitOutput -Args @("show-ref", "--verify", "--quiet", "refs/heads/$SyncBranch")
    $syncExists = $true
  } catch {
    $syncExists = $false
  }

  if ($syncExists) {
    if (-not $ResetBranch) {
      throw "Sync branch '$SyncBranch' already exists. Re-run with -ResetBranch or choose a different -SyncBranch."
    }

    Write-Host "Resetting existing sync branch '$SyncBranch' from '$BaseBranch'..."
    Invoke-Git -Args @("switch", $BaseBranch)
    Invoke-Git -Args @("branch", "-D", $SyncBranch)
  }

  Write-Host "Creating sync branch '$SyncBranch' from '$BaseBranch'..."
  Invoke-Git -Args @("switch", "-c", $SyncBranch, $BaseBranch)

  Write-Host "Merging $UpstreamRemote/$UpstreamBranch into $SyncBranch..."
  Invoke-Git -Args @("merge", "$UpstreamRemote/$UpstreamBranch")

  Write-Host ""
  Write-Host "Upstream sync branch is ready: $SyncBranch"
  Write-Host "Suggested verification commands:"
  Write-Host "  pnpm typecheck"
  Write-Host "  cd src-tauri; cargo check"
  Write-Host "  pnpm tauri build --no-bundle"
} finally {
  Pop-Location
}
