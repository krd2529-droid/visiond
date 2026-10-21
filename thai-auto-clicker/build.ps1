$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework compiler not found' }
$output = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$exe = Join-Path $output 'ThaiAutoClicker.exe'
$source = Join-Path $PSScriptRoot 'AutoClicker.cs'
$tests = Join-Path $PSScriptRoot 'Tests.cs'
& $compiler /nologo /target:winexe /main:ThaiAutoClicker.Program /platform:x64 /optimize+ /codepage:65001 /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/out:$exe" $source $tests
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$qa = Join-Path $output 'ThaiAutoClicker.QA.exe'
& $compiler /nologo /target:winexe /main:ThaiAutoClicker.QaProgram /platform:x64 /optimize+ /codepage:65001 /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/out:$qa" $source $tests
if ($LASTEXITCODE -ne 0) { throw 'QA build failed' }
Write-Output "Built $output/ThaiAutoClicker.exe"
