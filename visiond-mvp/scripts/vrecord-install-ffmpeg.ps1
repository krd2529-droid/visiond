param([string]$ArchivePath)
$ErrorActionPreference = 'Stop'
$publisherUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
$archiveHash = '60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA'
$engineHash = '3256173F3F8BFFD7DF12227C68ADF68025EDB1832273A9530688A7BB1ED8EDEC'
$engineEntry = 'ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe'
$licenseEntry = 'ffmpeg-9.0.2-essentials_build/LICENSE'
$readmeEntry = 'ffmpeg-9.0.2-essentials_build/README.txt'
$tools = Join-Path $PSScriptRoot 'tools'
function Get-Sha256([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    try {
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '') }
        finally { $hasher.Dispose() }
    } finally { $stream.Dispose() }
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('vrecord-ffmpeg-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $archive = if ($ArchivePath) { [IO.Path]::GetFullPath($ArchivePath) } else { Join-Path $temporary 'publisher.zip' }
    if (-not $ArchivePath) { Invoke-WebRequest -Uri $publisherUrl -OutFile $archive -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 180 }
    if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'ไม่พบ ZIP จากผู้เผยแพร่' }
    if ((Get-Sha256 $archive) -ne $archiveHash) { throw 'ZIP ของ FFmpeg ไม่ตรงกับรุ่น 9.0.2 ที่ตรวจไว้ กรุณาติดต่อ VisionD' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($item in @(@($engineEntry,'ffmpeg.exe'),@($licenseEntry,'FFmpeg-LICENSE.txt'),@($readmeEntry,'FFmpeg-README.txt'))) {
            $entry = $zip.GetEntry($item[0])
            if ($null -eq $entry) { throw ('ZIP ขาดไฟล์ ' + $item[0]) }
            $target = Join-Path $temporary $item[1]
            $inputStream = $entry.Open()
            try { $outputStream = [IO.File]::Create($target); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() } } finally { $inputStream.Dispose() }
        }
    } finally { $zip.Dispose() }
    $engine = Join-Path $temporary 'ffmpeg.exe'
    if ((Get-Sha256 $engine) -ne $engineHash) { throw 'ffmpeg.exe ไม่ตรงกับไฟล์ที่ตรวจไว้' }
    $devices = (& $engine -hide_banner -devices 2>&1 | Out-String)
    $encoders = (& $engine -hide_banner -encoders 2>&1 | Out-String)
    $filters = (& $engine -hide_banner -filters 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $devices -notmatch '\bgdigrab\b' -or $devices -notmatch '\bdshow\b' -or $encoders -notmatch '\blibx264\b' -or $encoders -notmatch '\baac\b' -or $filters -notmatch '\bass\b') { throw 'FFmpeg ที่ดาวน์โหลดไม่มีฟังก์ชันอัดหน้าจอ เสียง หรือซับที่ V-Record ต้องใช้' }
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    foreach ($name in @('FFmpeg-LICENSE.txt','FFmpeg-README.txt','ffmpeg.exe')) {
        Move-Item -LiteralPath (Join-Path $temporary $name) -Destination (Join-Path $tools $name) -Force
    }
    Write-Output 'ติดตั้ง FFmpeg 9.0.2 จากผู้เผยแพร่และตรวจ SHA-256 สำเร็จ เปิด V-Record.exe ได้แล้ว'
} finally { Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue }
