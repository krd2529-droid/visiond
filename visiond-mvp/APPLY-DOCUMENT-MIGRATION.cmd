@echo off
cd /d "%~dp0"
node scripts\migrate-document-history.mjs
if errorlevel 1 (
  echo.
  echo Document migration stopped safely. No conflicting file was deleted.
  pause
  exit /b 1
)
echo.
echo Document migration completed.
pause
