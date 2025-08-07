@echo off
title ASE CEMS - Standalone Runner
echo ================================
echo Starting ASE CEMS Standalone Application
echo ================================

echo.
echo Checking if build exists...
if not exist "build\win-unpacked\ASE CEMS.exe" (
    echo ❌ Build not found!
    echo Please run build-standalone.bat first
    pause
    exit /b 1
)

echo.
echo Starting CEMS Application...
cd build\win-unpacked
start "" "ASE CEMS.exe"

echo.
echo ✅ CEMS Application started!
echo The app should open automatically.
echo.
pause 