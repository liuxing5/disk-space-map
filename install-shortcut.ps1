$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$pythonw = $null
$pythonCmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
if ($pythonCmd) {
    $pythonw = $pythonCmd.Source
}
if (-not $pythonw) {
    $pythonCmd = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $candidate = Join-Path (Split-Path $pythonCmd.Source) "pythonw.exe"
        if (Test-Path $candidate) {
            $pythonw = $candidate
        }
    }
}
if (-not $pythonw) {
    Write-Host "Python 3.10+ was not found. Install Python and enable 'Add Python to PATH'." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$linkPath = Join-Path $desktop "磁盘空间地图.lnk"
$appPath = Join-Path $root "app.py"
$iconPath = Join-Path $root "assets\diskmap.ico"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = $pythonw
$shortcut.Arguments = '"' + $appPath + '"'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "磁盘空间地图 - 本地磁盘可视化与清理工具"
$shortcut.Save()

Write-Host "Desktop shortcut created:" -ForegroundColor Green
Write-Host $linkPath
Start-Sleep -Seconds 1
