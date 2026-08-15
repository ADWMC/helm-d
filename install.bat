@echo off
REM One-command deploy for helmd (Windows). Double-click entry point that
REM delegates to install.ps1 in the same directory, bypassing the PowerShell
REM execution policy so no manual Set-ExecutionPolicy is needed.

setlocal EnableExtensions

set "SELF_DIR=%~dp0"
set "PS1=%SELF_DIR%install.ps1"

if not exist "%PS1%" (
    echo [ERROR] install.ps1 was not found next to install.bat.
    echo         Download all assets from the latest helmd release and keep
    echo         install.bat and install.ps1 in the same folder.
    exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell is required but was not found on this machine.
    exit /b 1
)

echo [helmd] launching install.ps1 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*

exit /b %errorlevel%
