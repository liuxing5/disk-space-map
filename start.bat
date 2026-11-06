@echo off
setlocal
cd /d "%~dp0"

where pythonw >nul 2>nul
if not errorlevel 1 (
    start "" pythonw "%~dp0app.py"
    exit /b 0
)

where python >nul 2>nul
if not errorlevel 1 (
    echo Starting Disk Space Map...
    python "%~dp0app.py"
    exit /b 0
)

echo.
echo Python 3.10 or newer was not found.
echo Install Python from https://www.python.org/downloads/windows/
echo and enable "Add Python to PATH", then run start.bat again.
echo.
pause
exit /b 1
