$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$electronDist = Join-Path $appRoot 'node_modules\electron\dist'
$electronExe = Join-Path $electronDist 'electron.exe'
if (-not (Test-Path -LiteralPath $electronExe)) { throw 'Electron runtime is missing. Run npm install first.' }

$package = Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json
$target = Join-Path $appRoot ("dist\visiond-social-work-win32-x64-{0}" -f $package.version)
if (Test-Path -LiteralPath $target) { throw "Package already exists: $target" }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $electronDist '*') -Destination $target -Recurse
$appResources = Join-Path $target 'resources\app'
New-Item -ItemType Directory -Path $appResources -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $appRoot 'src') -Destination $appResources -Recurse
Copy-Item -LiteralPath (Join-Path $appRoot 'package.json') -Destination $appResources
Rename-Item -LiteralPath (Join-Path $target 'electron.exe') -NewName 'VisionD Social Work.exe'
Write-Output (Join-Path $target 'VisionD Social Work.exe')
