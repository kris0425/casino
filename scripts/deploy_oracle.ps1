<#
.SYNOPSIS
  Discord casino bot one-command incremental Oracle deployment.

.EXAMPLE
  .\scripts\deploy_oracle.ps1

.EXAMPLE
  .\scripts\deploy_oracle.ps1 -UpdateFile updates/2026-08-01-example.json
#>
[CmdletBinding()]
param(
  [string]$UpdateFile = '',
  [string]$OracleHost = 'ubuntu@161.33.185.80',
  [string]$OracleProject = '/home/ubuntu/discord-casino-bot',
  [string]$SshKey = 'E:\DC BOT\ssh-key-2026-07-12.key',
  [string]$PortableProject = 'E:\DC BOT\casino-bot-portable',
  [string]$InitialBaseCommit = '072e24eee51c6faf1e01e7b5660896c9aa40c590',
  [switch]$SkipPush,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Utf8NoBom = [Text.UTF8Encoding]::new($false)

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-ExitCode([string]$Action) {
  if($LASTEXITCODE -ne 0) { throw "$Action failed with exit code $LASTEXITCODE" }
}

function Normalize-RepoPath([string]$Path) {
  $normalized = $Path.Trim().Replace('\','/')
  while($normalized.StartsWith('./',[StringComparison]::Ordinal)) { $normalized = $normalized.Substring(2) }
  return $normalized.TrimStart('/')
}

function Write-LfFile([string]$Path,[string[]]$Lines) {
  if($Lines.Count) { $content = ($Lines -join "`n") + "`n" } else { $content = '' }
  [IO.File]::WriteAllText($Path,$content,$Utf8NoBom)
}

function Test-DeployPath([string]$Path) {
  $Path = Normalize-RepoPath $Path
  $rootFiles = @('.dockerignore','Dockerfile','docker-compose.yml','package.json','package-lock.json','CHANGELOG.md')
  if($rootFiles -contains $Path) { return $true }
  foreach($prefix in @('src/','assets/','activity/public/','scripts/','updates/','tests/')) {
    if($Path.StartsWith($prefix,[StringComparison]::Ordinal)) { return $true }
  }
  return $false
}

$RepoCandidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $RepoCandidate
try {
  $RepoRoot = ((& git rev-parse --show-toplevel) -join "`n").Trim()
  Assert-ExitCode 'resolve repository root'
} finally { Pop-Location }
$RepoRoot = [IO.Path]::GetFullPath($RepoRoot)

foreach($command in @('git.exe','tar.exe','ssh.exe','scp.exe','node.exe','npm.cmd')) {
  if(-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "required command is missing: $command" }
}
if(-not (Test-Path -LiteralPath $SshKey -PathType Leaf)) { throw "SSH key not found: $SshKey" }
if(-not (Test-Path -LiteralPath $PortableProject -PathType Container)) { throw "portable project not found: $PortableProject" }

Push-Location $RepoRoot
try {
  $HeadCommit = ((& git rev-parse HEAD) -join '').Trim()
  Assert-ExitCode 'resolve HEAD'
} finally { Pop-Location }
if($HeadCommit -notmatch '^[0-9a-f]{40}$') { throw "invalid HEAD commit: $HeadCommit" }
$ShortCommit = $HeadCommit.Substring(0,7)
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) "casino-deploy-$ShortCommit-$PID"
$TempKey = Join-Path $TempRoot 'oracle.key'
$BundlePath = Join-Path $TempRoot 'changes.tar'
$CopyListPath = Join-Path $TempRoot 'copy-files.txt'
$DeleteListPath = Join-Path $TempRoot 'delete-files.txt'
$RemoteStage = "/home/ubuntu/release-staging/$ShortCommit"
$DeploymentSucceeded = $false

try {
  [IO.Directory]::CreateDirectory($TempRoot) | Out-Null
  Copy-Item -LiteralPath $SshKey -Destination $TempKey -Force
  & icacls.exe $TempKey /inheritance:r | Out-Null
  $Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $TempKey /grant:r "$Identity`:(R)" | Out-Null
  $SshArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-i',$TempKey,$OracleHost)

  Write-Step 'Reading the last deployed Oracle commit'
  $RemoteBaseOutput = @(& ssh.exe @SshArgs "cat $OracleProject/.deployed_commit 2>/dev/null || true")
  Assert-ExitCode 'read Oracle deployment marker'
  $BaseCommit = ($RemoteBaseOutput -join '').Trim()
  if(-not $BaseCommit) {
    $BaseCommit = $InitialBaseCommit
    Write-Host "Oracle marker is absent; using bootstrap base $BaseCommit"
  }
  if($BaseCommit -notmatch '^[0-9a-f]{7,40}$') { throw "invalid Oracle base commit: $BaseCommit" }

  Push-Location $RepoRoot
  try {
    & git cat-file -e "${BaseCommit}^{commit}"
    Assert-ExitCode 'validate base commit'
    & git merge-base --is-ancestor $BaseCommit $HeadCommit
    Assert-ExitCode 'verify fast-forward deployment history'
    $DiffLines = @(& git diff --name-status --find-renames "${BaseCommit}..${HeadCommit}")
    Assert-ExitCode 'calculate incremental file list'
  } finally { Pop-Location }

  if($BaseCommit -eq $HeadCommit -and -not $Force) {
    Write-Host "Oracle already runs commit $HeadCommit. Use -Force to redeploy."
    $DeploymentSucceeded = $true
    return
  }

  $CopySet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $DeleteSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach($line in $DiffLines) {
    if([string]::IsNullOrWhiteSpace($line)) { continue }
    $fields = $line -split "`t"
    $status = $fields[0].Substring(0,1)
    if($status -eq 'D') {
      $path = Normalize-RepoPath $fields[1]
      if(Test-DeployPath $path) { [void]$DeleteSet.Add($path) }
      continue
    }
    if($status -eq 'R') {
      $oldPath = Normalize-RepoPath $fields[1]
      $newPath = Normalize-RepoPath $fields[2]
      if(Test-DeployPath $oldPath) { [void]$DeleteSet.Add($oldPath) }
      if(Test-DeployPath $newPath) { [void]$CopySet.Add($newPath) }
      continue
    }
    $path = Normalize-RepoPath $fields[-1]
    if(Test-DeployPath $path) { [void]$CopySet.Add($path) }
  }

  foreach($required in @('scripts/deploy_oracle.ps1','scripts/deploy_oracle_remote.sh','scripts/backup_sqlite.mjs','tests/achievements.test.js')) {
    [void]$CopySet.Add($required)
  }
  if($UpdateFile) {
    $UpdateFile = Normalize-RepoPath $UpdateFile
    if($UpdateFile -notmatch '^updates/[A-Za-z0-9._/-]+\.json$') { throw "invalid update file path: $UpdateFile" }
    [void]$CopySet.Add($UpdateFile)
  }

  $CopyPaths = @($CopySet | Sort-Object)
  $DeletePaths = @($DeleteSet | Sort-Object)
  foreach($relative in $CopyPaths) {
    $fullPath = Join-Path $RepoRoot ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))
    if(-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "committed deployment file is missing: $relative" }
  }

  Push-Location $RepoRoot
  try {
    $DirtyPaths = @(& git diff --name-only) + @(& git diff --cached --name-only) + @(& git ls-files --others --exclude-standard)
    Assert-ExitCode 'inspect local changes'
    foreach($relative in $CopyPaths) {
      & git cat-file -e "${HeadCommit}:$relative"
      Assert-ExitCode "verify committed deployment file $relative"
    }
  } finally { Pop-Location }
  $DirtySet = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($path in $DirtyPaths) { if($path) { [void]$DirtySet.Add((Normalize-RepoPath $path)) } }
  $Overlaps = @($CopyPaths | Where-Object { $DirtySet.Contains($_) })
  if($Overlaps.Count) { throw "deployment files have uncommitted changes: $($Overlaps -join ', ')" }

  Write-Step 'Running local syntax and regression tests'
  Push-Location $RepoRoot
  try {
    & node.exe --check src/index.js
    Assert-ExitCode 'JavaScript syntax check'
    & npm.cmd test
    Assert-ExitCode 'local regression tests'
    if(-not $SkipPush) {
      Write-Step 'Pushing the exact HEAD commit to GitHub main'
      & git push origin HEAD:main
      Assert-ExitCode 'push GitHub main'
    }
  } finally { Pop-Location }

  Write-LfFile $CopyListPath $CopyPaths
  Write-LfFile $DeleteListPath $DeletePaths
  Write-Step "Packing $($CopyPaths.Count) changed/required files ($($DeletePaths.Count) deletions)"
  & tar.exe -cf $BundlePath -C $RepoRoot -T $CopyListPath
  Assert-ExitCode 'create incremental deployment archive'

  Write-Step 'Uploading one incremental archive to Oracle'
  & ssh.exe @SshArgs "mkdir -p $RemoteStage/source /home/ubuntu/release-backups/$ShortCommit"
  Assert-ExitCode 'create Oracle staging directories'
  & scp.exe -q -i $TempKey $BundlePath "${OracleHost}:$RemoteStage/changes.tar"
  Assert-ExitCode 'upload deployment archive'
  & scp.exe -q -i $TempKey $DeleteListPath "${OracleHost}:$RemoteStage/delete-files.txt"
  Assert-ExitCode 'upload deletion manifest'
  & ssh.exe @SshArgs "tar -xf $RemoteStage/changes.tar -C $RemoteStage/source"
  Assert-ExitCode 'extract Oracle deployment archive'

  if($UpdateFile) { $UpdateArgument = $UpdateFile } else { $UpdateArgument = '-' }
  Write-Step 'Backing up, building, testing, restarting and verifying Oracle'
  & ssh.exe @SshArgs "bash $RemoteStage/source/scripts/deploy_oracle_remote.sh $OracleProject $RemoteStage $ShortCommit $HeadCommit $UpdateArgument"
  Assert-ExitCode 'Oracle deployment pipeline'
  $DeploymentSucceeded = $true

  Write-Step 'Synchronizing the E-drive portable project'
  $PortableRoot = [IO.Path]::GetFullPath($PortableProject)
  foreach($relative in $CopyPaths) {
    $source = Join-Path $RepoRoot ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))
    $destination = Join-Path $PortableRoot ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
  foreach($relative in $DeletePaths) {
    $destination = [IO.Path]::GetFullPath((Join-Path $PortableRoot ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))))
    if(-not $destination.StartsWith($PortableRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
      throw "unsafe portable deletion path: $destination"
    }
    if(Test-Path -LiteralPath $destination -PathType Leaf) { Remove-Item -LiteralPath $destination -Force }
  }

  Write-Host "`nDEPLOY_OK commit=$HeadCommit backup=/home/ubuntu/release-backups/$ShortCommit/casino.sqlite rollback=discord-casino-backup:pre-$ShortCommit" -ForegroundColor Green
} finally {
  if(Test-Path -LiteralPath $TempKey) {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $TempKey /grant:r "$Identity`:(F)" | Out-Null
  }
  if(Test-Path -LiteralPath $TempRoot) {
    $ResolvedTemp = [IO.Path]::GetFullPath($TempRoot)
    $SystemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if($ResolvedTemp.StartsWith($SystemTemp,[StringComparison]::OrdinalIgnoreCase) -and $ResolvedTemp -ne $SystemTemp) {
      Remove-Item -LiteralPath $ResolvedTemp -Recurse -Force
    }
  }
  if(-not $DeploymentSucceeded) {
    Write-Warning "Deployment did not complete. Oracle staging is preserved at $RemoteStage when it was created."
  }
}
