@echo off
cd /d "%~dp0"
if not exist "dist\ThaiAutoClicker.exe" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
if not exist "dist\ThaiAutoClicker.exe" exit /b 1
start "" "%~dp0dist\ThaiAutoClicker.exe"
