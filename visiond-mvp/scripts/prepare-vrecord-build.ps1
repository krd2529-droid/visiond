param(
    [Parameter(Mandatory)][string]$HandoffDirectory,
    [Parameter(Mandatory)][string]$FfmpegZip,
    [string]$PublicKeyXml = (Join-Path $PSScriptRoot 'vrecord-public-key.xml'),
    [Parameter(Mandatory)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$expectedFfmpegHash = '60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is unavailable' }
if ((Get-FileHash -LiteralPath $FfmpegZip -Algorithm SHA256).Hash -ne $expectedFfmpegHash) { throw 'FFmpeg archive hash does not match the reviewed Gyan release' }
if (-not (Test-Path -LiteralPath (Join-Path $HandoffDirectory 'Recorder.cs'))) { throw 'V-Record handoff source is missing' }
if (-not (Test-Path -LiteralPath $PublicKeyXml)) { throw 'Reviewed RSA public key is missing' }
$xml = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $PublicKeyXml))
if ($xml -notmatch '^<RSAKeyValue><Modulus>[A-Za-z0-9+/=]+</Modulus><Exponent>[A-Za-z0-9+/=]+</Exponent></RSAKeyValue>\s*$') { throw 'Public key XML is invalid' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Use a new, empty output directory so no prior build can be mistaken for this build' }
New-Item -ItemType Directory -Path $output | Out-Null
$source = Join-Path $output 'source'
$customer = Join-Path $output 'customer'
$ffmpeg = Join-Path $output 'ffmpeg-extract'
Copy-Item -LiteralPath $HandoffDirectory -Destination $source -Recurse
New-Item -ItemType Directory -Path $customer,$ffmpeg,(Join-Path $customer 'tools') | Out-Null
Expand-Archive -LiteralPath $FfmpegZip -DestinationPath $ffmpeg
$engineRoot = Join-Path $ffmpeg 'ffmpeg-9.0.2-essentials_build'
foreach ($required in @('bin/ffmpeg.exe','LICENSE','README.txt')) {
    if (-not (Test-Path -LiteralPath (Join-Path $engineRoot $required))) { throw "FFmpeg archive missing $required" }
}
Copy-Item -LiteralPath (Join-Path $engineRoot 'bin/ffmpeg.exe') -Destination (Join-Path $customer 'tools/ffmpeg.exe')
Copy-Item -LiteralPath (Join-Path $engineRoot 'LICENSE') -Destination (Join-Path $customer 'tools/FFmpeg-LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $engineRoot 'README.txt') -Destination (Join-Path $customer 'tools/FFmpeg-README.txt')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vrecord-customer-readme.txt') -Destination (Join-Path $customer 'README.txt')
Copy-Item -LiteralPath $PublicKeyXml -Destination (Join-Path $source 'licensing/public-key.xml')
[IO.File]::WriteAllText((Join-Path $source 'licensing/client-config.json'),'{"serverUrl":"https://visiondonline.com"}',[Text.UTF8Encoding]::new($false))

# The handoff UI hard-codes an annual label; this release supports monthly, yearly and trial.
foreach ($name in @('Recorder.cs','Licensing.cs')) {
    $file = Join-Path $source $name
    $before = [IO.File]::ReadAllText($file)
    $after = $before.Replace('V-Record รายปี • ยังไม่ได้เปิดใช้งาน','V-Record • ยังไม่ได้เปิดใช้งาน').Replace('ใบอนุญาตรายปี','ใบอนุญาต').Replace('เปิดใช้งาน V-Record รายปี','เปิดใช้งาน V-Record').Replace('รายปี • หมดอายุ','หมดอายุ')
    if ($before -eq $after) { throw "Expected license UI labels were not found in $name" }
    [IO.File]::WriteAllText($file,$after,[Text.UTF8Encoding]::new($false))
}

$logo = Join-Path $source 'assets/GenerateLogo.exe'
& $compiler /nologo "/out:$logo" /reference:System.Drawing.dll (Join-Path $source 'assets/GenerateLogo.cs')
if ($LASTEXITCODE -ne 0) { throw 'Logo compiler failed' }
& $logo (Join-Path $source 'assets')
if ($LASTEXITCODE -ne 0) { throw 'Logo generator failed' }
& $compiler /nologo /target:winexe "/out:$(Join-Path $customer 'V-Record.Updater.exe')" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll /reference:System.IO.Compression.dll (Join-Path $source 'UpdaterMain.cs') (Join-Path $source 'UpdateCore.cs') (Join-Path $source 'Integrity.cs') (Join-Path $source 'Licensing.cs') (Join-Path $source 'AppVersion.cs') "/resource:$(Join-Path $source 'licensing/public-key.xml'),LicensePublicKey"
if ($LASTEXITCODE -ne 0) { throw 'Updater compiler failed' }
& $compiler /nologo /target:winexe "/out:$(Join-Path $customer 'V-Record.exe')" "/win32icon:$(Join-Path $source 'assets/V-Record.ico')" "/resource:$(Join-Path $source 'assets/V-Record.ico'),AppIcon" "/resource:$(Join-Path $source 'assets/logo.png'),AppLogo" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Xml.Linq.dll /reference:System.IO.Compression.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll (Join-Path $source 'Recorder.cs') (Join-Path $source 'RecordingSession.cs') (Join-Path $source 'AudioCapture.cs') (Join-Path $source 'Licensing.cs') (Join-Path $source 'Integrity.cs') (Join-Path $source 'Support.cs') (Join-Path $source 'Subtitles.cs') (Join-Path $source 'Updates.cs') (Join-Path $source 'UpdateCore.cs') (Join-Path $source 'AppVersion.cs') "/resource:$(Join-Path $source 'licensing/public-key.xml'),LicensePublicKey" "/resource:$(Join-Path $source 'licensing/client-config.json'),LicenseConfig"
if ($LASTEXITCODE -ne 0) { throw 'V-Record compiler failed' }
Write-Output "Unsigned build prepared at $customer"
Write-Output 'Do not distribute: package-manifest.json is deliberately absent until trusted signing completes.'
