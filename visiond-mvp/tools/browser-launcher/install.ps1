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

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The required Windows C# compiler was not found.' }

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
if (Test-Path -LiteralPath $candidatePath) { Remove-Item -LiteralPath $candidatePath -Force }
& $compiler /nologo /target:exe /optimize+ /out:$candidatePath (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $candidatePath)) { throw 'Launcher compilation failed.' }
Move-Item -LiteralPath $candidatePath -Destination $launcherPath -Force
Write-VisionDLauncherMarker -LauncherPath $launcherPath -MarkerPath $ownerMarker

New-Item -Path $schemeKey -Force | Out-Null
Set-Item -LiteralPath $schemeKey -Value 'URL:VisionD isolated Chrome profile'
New-ItemProperty -LiteralPath $schemeKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Path $commandKey -Force | Out-Null
Set-Item -LiteralPath $commandKey -Value $expectedCommand
Send-VisionDShellAssociationChanged

Write-Output 'VisionD Browser Launcher installed for the current Windows user.'
Write-Output 'Browser profiles are stored under LocalAppData\VisionD\BrowserLauncher\Profiles.'
