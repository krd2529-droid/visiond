$ErrorActionPreference = 'Stop'

$schemeKey = 'HKCU:\Software\Classes\visiond-profile'
$installRoot = Join-Path $env:LOCALAPPDATA 'VisionD\BrowserLauncher'
$launcherPath = Join-Path $installRoot 'VisionDBrowserLauncher.exe'
$candidatePath = Join-Path $installRoot 'VisionDBrowserLauncher.new.exe'
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

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The required Windows C# compiler was not found.' }

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
if (Test-Path -LiteralPath $candidatePath) { Remove-Item -LiteralPath $candidatePath -Force }
& $compiler /nologo /target:winexe /optimize+ /r:System.Security.dll /r:System.Web.Extensions.dll /out:$candidatePath (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $candidatePath)) { throw 'Launcher compilation failed.' }
Stop-VisionDOwnedService -LauncherPath $launcherPath -FileState $fileState
Move-Item -LiteralPath $candidatePath -Destination $launcherPath -Force
Write-VisionDLauncherMarker -LauncherPath $launcherPath -MarkerPath $ownerMarker
$initialization = Start-Process -FilePath $launcherPath -ArgumentList '--init' -WindowStyle Hidden -PassThru -Wait
if ($initialization.ExitCode -ne 0) { throw 'Launcher private configuration initialization failed.' }
$service = Start-Process -FilePath $launcherPath -ArgumentList '--serve' -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 300
$service.Refresh()
if ($service.HasExited) { throw 'Launcher service did not start; inspect the owned configuration/port.' }
$listener = @(Get-NetTCPConnection -State Listen -OwningProcess $service.Id -ErrorAction SilentlyContinue)
if ($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1' -or $listener[0].LocalPort -lt 49152 -or $listener[0].LocalPort -gt 65535) {
    Stop-VisionDOwnedService -LauncherPath $launcherPath -FileState 'Owned'
    throw 'Launcher listener ownership could not be verified. No unrelated process was stopped.'
}
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -LiteralPath $runKey -Name $runName -Value $serveCommand -PropertyType String -Force | Out-Null

New-Item -Path $schemeKey -Force | Out-Null
Set-Item -LiteralPath $schemeKey -Value 'URL:VisionD isolated Chrome profile'
New-ItemProperty -LiteralPath $schemeKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Path $commandKey -Force | Out-Null
Set-Item -LiteralPath $commandKey -Value $expectedCommand
Send-VisionDShellAssociationChanged

Write-Output 'VisionD Browser Launcher installed for the current Windows user.'
Write-Output 'Browser profiles are stored under LocalAppData\VisionD\BrowserLauncher\Profiles.'
Write-Output 'Local helper is running. Initial pairing is a separate explicit --pair action; compare its code and confirm in VisionD.'
