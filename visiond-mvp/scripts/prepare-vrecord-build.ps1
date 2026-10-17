param(
    [Parameter(Mandatory)][string]$HandoffDirectory,
    [string]$PublicKeyXml = (Join-Path $PSScriptRoot 'vrecord-public-key.xml'),
    [Parameter(Mandatory)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is unavailable' }
if (-not (Test-Path -LiteralPath (Join-Path $HandoffDirectory 'Recorder.cs'))) { throw 'V-Record handoff source is missing' }
if (-not (Test-Path -LiteralPath $PublicKeyXml)) { throw 'Reviewed RSA public key is missing' }
$xml = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $PublicKeyXml))
if ($xml -notmatch '^<RSAKeyValue><Modulus>[A-Za-z0-9+/=]+</Modulus><Exponent>[A-Za-z0-9+/=]+</Exponent></RSAKeyValue>\s*$') { throw 'Public key XML is invalid' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Use a new, empty output directory so no prior build can be mistaken for this build' }
New-Item -ItemType Directory -Path $output | Out-Null
$source = Join-Path $output 'source'
$customer = Join-Path $output 'customer'
Copy-Item -LiteralPath $HandoffDirectory -Destination $source -Recurse
New-Item -ItemType Directory -Path $customer | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vrecord-customer-readme.txt') -Destination (Join-Path $customer 'README.txt')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vrecord-install-ffmpeg.ps1') -Destination (Join-Path $customer 'Install-FFmpeg.ps1')
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

function Replace-Required([string]$name,[string]$before,[string]$after,[int]$count = 1) {
    $file = Join-Path $source $name
    $text = [IO.File]::ReadAllText($file)
    if ([regex]::Matches($text,[regex]::Escape($before)).Count -ne $count) { throw "Expected $count occurrence(s) in $name" }
    [IO.File]::WriteAllText($file,$text.Replace($before,$after),[Text.UTF8Encoding]::new($false))
}
Replace-Required 'Integrity.cs' 'if((hashes.Count!=2&&hashes.Count!=3)||!hashes.ContainsKey("V-Record.exe")||!hashes.ContainsKey("tools/ffmpeg.exe")||(hashes.Count==3&&!hashes.ContainsKey("V-Record.Updater.exe")))' 'if(hashes.Count!=4||!hashes.ContainsKey("V-Record.exe")||!hashes.ContainsKey("V-Record.Updater.exe")||!hashes.ContainsKey("Install-FFmpeg.ps1")||!hashes.ContainsKey("README.txt"))'
Replace-Required 'UpdateCore.cs' '"V-Record.exe","V-Record.Updater.exe","tools/ffmpeg.exe","package-manifest.json","README.txt","tools/FFmpeg-LICENSE.txt","tools/FFmpeg-README.txt"' '"V-Record.exe","V-Record.Updater.exe","Install-FFmpeg.ps1","package-manifest.json","README.txt"'
Replace-Required 'Recorder.cs' 'if(!File.Exists(Engine)){Missing();return;}' 'if(!ExternalEngine.Ready(Engine)){Missing();return;}' 2
Replace-Required 'Recorder.cs' 'void Missing(){MessageBox.Show("กรุณาเรียก Setup-FFmpeg.ps1 เพื่อติดตั้ง FFmpeg ก่อนใช้งานอัดวิดีโอ", "ต้องติดตั้ง FFmpeg");}' 'void Missing(){MessageBox.Show("FFmpeg ยังไม่พร้อมหรือไม่ตรงรุ่น กดปุ่ม ติดตั้ง FFmpeg ในหน้าหลัก แล้วเปิดแอปใหม่หลังติดตั้งเสร็จ", "ต้องติดตั้ง FFmpeg");} void InstallEngine(){try{PackageIntegrity.VerifyInstalled();string script=Path.Combine(root,"Install-FFmpeg.ps1");var start=new ProcessStartInfo("powershell.exe","-NoProfile -NoExit -ExecutionPolicy Bypass -File "+Quote(script)){UseShellExecute=true,WorkingDirectory=root};Process.Start(start);}catch(Exception error){MessageBox.Show(error.Message,"ติดตั้ง FFmpeg ไม่ได้");}}'
Replace-Required 'Recorder.cs' 'string selected=null;if(files.SelectedItems.Count>0' 'if(!ExternalEngine.Ready(Engine)){Missing();return;}string selected=null;if(files.SelectedItems.Count>0'
Replace-Required 'Recorder.cs' 'host=home;Btn("เลือกคลิปใส่ซับ",430,295,235,delegate{OpenSubtitles();});' 'host=home;Btn("ติดตั้ง FFmpeg",0,295,205,delegate{InstallEngine();});Btn("เลือกคลิปใส่ซับ",430,295,235,delegate{OpenSubtitles();});'
Replace-Required 'Recorder.cs' 'if(session!=null||verifyingLicense)return;if(!await EnsureRecordingLicense())return;if(IsDisposed)return;if(!ExternalEngine.Ready(Engine)){Missing();return;}' 'if(session!=null||verifyingLicense)return;if(!ExternalEngine.Ready(Engine)){Missing();return;}if(!await EnsureRecordingLicense())return;if(IsDisposed)return;'

$logo = Join-Path $source 'assets/GenerateLogo.exe'
& $compiler /nologo "/out:$logo" /reference:System.Drawing.dll (Join-Path $source 'assets/GenerateLogo.cs')
if ($LASTEXITCODE -ne 0) { throw 'Logo compiler failed' }
& $logo (Join-Path $source 'assets')
if ($LASTEXITCODE -ne 0) { throw 'Logo generator failed' }
& $compiler /nologo /target:winexe "/out:$(Join-Path $customer 'V-Record.Updater.exe')" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll /reference:System.IO.Compression.dll (Join-Path $source 'UpdaterMain.cs') (Join-Path $source 'UpdateCore.cs') (Join-Path $source 'Integrity.cs') (Join-Path $source 'Licensing.cs') (Join-Path $source 'AppVersion.cs') "/resource:$(Join-Path $source 'licensing/public-key.xml'),LicensePublicKey"
if ($LASTEXITCODE -ne 0) { throw 'Updater compiler failed' }
& $compiler /nologo /target:winexe "/out:$(Join-Path $customer 'V-Record.exe')" "/win32icon:$(Join-Path $source 'assets/V-Record.ico')" "/resource:$(Join-Path $source 'assets/V-Record.ico'),AppIcon" "/resource:$(Join-Path $source 'assets/logo.png'),AppLogo" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Xml.Linq.dll /reference:System.IO.Compression.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll (Join-Path $source 'Recorder.cs') (Join-Path $source 'RecordingSession.cs') (Join-Path $source 'AudioCapture.cs') (Join-Path $source 'Licensing.cs') (Join-Path $source 'Integrity.cs') (Join-Path $source 'Support.cs') (Join-Path $source 'Subtitles.cs') (Join-Path $source 'Updates.cs') (Join-Path $source 'UpdateCore.cs') (Join-Path $source 'AppVersion.cs') (Join-Path $PSScriptRoot 'vrecord-external-engine.cs') "/resource:$(Join-Path $source 'licensing/public-key.xml'),LicensePublicKey" "/resource:$(Join-Path $source 'licensing/client-config.json'),LicenseConfig"
if ($LASTEXITCODE -ne 0) { throw 'V-Record compiler failed' }
Write-Output "Unsigned build prepared at $customer"
Write-Output 'Do not distribute: package-manifest.json is deliberately absent until trusted signing completes.'
