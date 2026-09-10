$ErrorActionPreference = 'Stop'

$schemeKey = 'HKCU:\Software\Classes\visiond-profile'
$installRoot = Join-Path $env:LOCALAPPDATA 'VisionD\BrowserLauncher'
$launcherPath = Join-Path $installRoot 'VisionDBrowserLauncher.exe'
$ownerMarker = Join-Path $installRoot 'owner.txt'
$expectedCommand = '"' + $launcherPath + '" "%1"'
$commandKey = Join-Path $schemeKey 'shell\open\command'
$stateHelpers = Join-Path $PSScriptRoot 'InstallState.ps1'
. $stateHelpers

$fileState = Get-VisionDLauncherFileState -InstallRoot $installRoot
$schemeExists = Test-Path -LiteralPath $schemeKey
$commandItem = if ($schemeExists) { Get-Item -LiteralPath $commandKey -ErrorAction SilentlyContinue } else { $null }
$currentCommand = if ($null -ne $commandItem) { $commandItem.GetValue('') } else { '' }
Assert-VisionDProtocolState -Exists $schemeExists -CurrentCommand $currentCommand -ExpectedCommand $expectedCommand -FileState $fileState
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runName = 'VisionDBrowserLauncher'
$serveCommand = '"' + $launcherPath + '" --serve'
$runItem = Get-Item -LiteralPath $runKey -ErrorAction SilentlyContinue
$currentRun = if ($null -ne $runItem) { [string]$runItem.GetValue($runName) } else { '' }
Assert-VisionDStartupState -CurrentCommand $currentRun -ExpectedCommand $serveCommand -FileState $fileState
Stop-VisionDOwnedService -LauncherPath $launcherPath -FileState $fileState
if ($currentRun -eq $serveCommand) { Remove-ItemProperty -LiteralPath $runKey -Name $runName }

if ($schemeExists) {
    Remove-Item -LiteralPath $schemeKey -Recurse -Force
    Send-VisionDShellAssociationChanged
}

if ($fileState -eq 'Owned') {
    Remove-Item -LiteralPath $ownerMarker -Force
    Remove-Item -LiteralPath $launcherPath -Force
}

Write-Output 'VisionD Browser Launcher protocol and executable removed.'
Write-Output 'Saved Chrome profiles were preserved under LocalAppData\VisionD\BrowserLauncher\Profiles.'
Write-Output 'DPAPI pairing identity and launch journals are retained for safe reinstall; explicitly pairing a replacement revokes the previous backend key.'
