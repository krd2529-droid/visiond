param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
if (-not $JavaHome) {
    $local = Join-Path $PSScriptRoot '..\.tools\java'
    if (Test-Path $local) { $JavaHome = (Get-ChildItem $local -Directory | Select-Object -First 1).FullName }
}
if (-not $JavaHome) { throw 'Set JAVA_HOME to a JDK 17 installation.' }
$out = Join-Path $PSScriptRoot 'tests\out'
New-Item -ItemType Directory -Force $out | Out-Null
& (Join-Path $JavaHome 'bin\javac.exe') -encoding UTF-8 -d $out (Join-Path $PSScriptRoot 'app\src\main\java\com\smsmix\app\CampaignCore.java') (Join-Path $PSScriptRoot 'tests\CoreTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Core test compilation failed.' }
& (Join-Path $JavaHome 'bin\java.exe') -cp $out com.smsmix.app.CoreTest
if ($LASTEXITCODE -ne 0) { throw 'Core tests failed.' }
