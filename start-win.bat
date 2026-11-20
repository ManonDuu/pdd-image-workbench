@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found.
  echo Install the current Active LTS ^(Node 26^) or a maintained 22 / 24 LTS from https://nodejs.org
  echo This script has not been verified on a real Windows machine yet.
  exit /b 1
)

node "scripts\start-workbench.mjs"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo Start failed with exit code %EXITCODE%.
  echo This script has not been verified on a real Windows machine yet.
)
exit /b %EXITCODE%
