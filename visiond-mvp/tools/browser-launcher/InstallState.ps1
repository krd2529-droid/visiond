$script:VisionDLauncherMarkerVersion = 'VisionD Browser Launcher v1'
$script:VisionDShellAssociationChangedEvent = [uint32]0x08000000
$script:VisionDShellAssociationNotifyFlags = [uint32](0x0000 -bor 0x1000)

function Send-VisionDShellAssociationChanged {
    param([scriptblock]$NotifyOverride)

    if ($null -ne $NotifyOverride) {
        & $NotifyOverride $script:VisionDShellAssociationChangedEvent $script:VisionDShellAssociationNotifyFlags
        return
    }
    if ($null -eq ([System.Management.Automation.PSTypeName]'VisionD.ShellAssociationNative').Type) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace VisionD {
    public static class ShellAssociationNative {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
    }
}
'@
    }
    [VisionD.ShellAssociationNative]::SHChangeNotify(
        $script:VisionDShellAssociationChangedEvent,
        $script:VisionDShellAssociationNotifyFlags,
        [IntPtr]::Zero,
        [IntPtr]::Zero
    )
}

function Get-VisionDLauncherSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return (($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString('X2') }) -join '')
    } finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Get-VisionDLauncherFileState {
    param([Parameter(Mandatory = $true)][string]$InstallRoot)

    $launcherPath = Join-Path $InstallRoot 'VisionDBrowserLauncher.exe'
    $ownerMarker = Join-Path $InstallRoot 'owner.txt'
    $hasLauncher = Test-Path -LiteralPath $launcherPath -PathType Leaf
    $hasMarker = Test-Path -LiteralPath $ownerMarker -PathType Leaf
    if (-not $hasLauncher -and -not $hasMarker) { return 'Empty' }
    if (-not $hasLauncher -or -not $hasMarker) { throw 'Launcher ownership files are incomplete. Nothing was changed.' }

    $lines = @(Get-Content -LiteralPath $ownerMarker)
    if ($lines.Count -ne 2 -or $lines[0] -ne $script:VisionDLauncherMarkerVersion -or $lines[1] -notmatch '^sha256=([0-9A-F]{64})$') {
        throw 'Launcher ownership marker is invalid. Nothing was changed.'
    }
    $actualHash = Get-VisionDLauncherSha256 -Path $launcherPath
    if ($actualHash -ne $Matches[1]) { throw 'Launcher executable does not match its ownership marker. Nothing was changed.' }
    return 'Owned'
}

function Assert-VisionDProtocolState {
    param(
        [Parameter(Mandatory = $true)][bool]$Exists,
        [AllowEmptyString()][string]$CurrentCommand,
        [Parameter(Mandatory = $true)][string]$ExpectedCommand,
        [Parameter(Mandatory = $true)][ValidateSet('Empty', 'Owned')][string]$FileState
    )
    if (-not $Exists) { return }
    if ($CurrentCommand -ne $ExpectedCommand -or $FileState -ne 'Owned') {
        throw 'The visiond-profile protocol is already registered by another application or an incomplete install. Nothing was changed.'
    }
}

function Write-VisionDLauncherMarker {
    param(
        [Parameter(Mandatory = $true)][string]$LauncherPath,
        [Parameter(Mandatory = $true)][string]$MarkerPath
    )
    $hash = Get-VisionDLauncherSha256 -Path $LauncherPath
    Set-Content -LiteralPath $MarkerPath -Value @($script:VisionDLauncherMarkerVersion, "sha256=$hash") -Encoding ASCII
}
