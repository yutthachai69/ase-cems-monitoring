@echo off
title Build Backend Executable
echo ================================
echo Building Backend as Executable
echo ================================

echo.
echo 1. Installing PyInstaller...
pip install pyinstaller

echo.
echo 2. Building Backend Executable...
pyinstaller --onefile --add-data "config.json;." --add-data "mapping.json;." --add-data "blowback_settings.json;." --add-data "CEMS_DataLog.csv;." main.py

echo.
echo 3. Copying executable to resources...
if not exist "dist\main.exe" (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Backend executable created: dist/main.exe
echo Copy this file to: cems-frontend/electron/backend.exe
echo.
pause 