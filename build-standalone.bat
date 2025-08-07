@echo off
title ASE CEMS - Standalone Build
echo ================================
echo Building Standalone ASE CEMS Monitoring Application
echo ================================

echo.
echo 1. Cleaning previous builds...
if exist "cems-frontend\dist" rmdir /s /q "cems-frontend\dist"
if exist "build" rmdir /s /q "build"

echo.
echo 2. Installing Frontend Dependencies...
cd cems-frontend
call npm install

echo.
echo 3. Installing Backend Dependencies...
cd ..\cems-backend
pip install -r requirements.txt

echo.
echo 4. Building Backend Executable...
call build-exe.bat

echo.
echo 5. Copying Backend Executable...
if exist "dist\main.exe" (
    copy "dist\main.exe" "..\cems-frontend\electron\backend.exe"
    echo ✅ Backend executable copied
) else (
    echo ❌ Backend executable not found!
    pause
    exit /b 1
)

echo.
echo 6. Building Frontend...
cd ..\cems-frontend
call npm run build

echo.
echo 7. Building Electron App...
call npm run build-standalone

echo.
echo ================================
echo ✅ Build Complete!
echo ================================
echo.
echo Files created in: build/
echo - ASE CEMS Monitoring Setup 1.0.0.exe (Installer)
echo - win-unpacked/ASE CEMS Monitoring.exe (Portable)
echo.
echo The app now includes both frontend and backend!
echo Backend is now a standalone executable - no Python required!
echo.
echo To run the app:
echo 1. Double-click "ASE CEMS Monitoring Setup 1.0.0.exe" to install
echo 2. Or run "win-unpacked/ASE CEMS Monitoring.exe" directly
echo.
pause 