@echo off
title Test Backend Executable
echo ================================
echo Testing Backend Executable
echo ================================

echo.
echo 1. Testing backend executable directly...
cd build\win-unpacked\resources
echo Running: backend.exe
start /wait backend.exe

echo.
echo 2. Testing with timeout...
timeout /t 5 /nobreak > nul

echo.
echo 3. Checking if backend is running...
netstat -an | findstr :8000
if %errorlevel% equ 0 (
    echo ✅ Backend is running on port 8000
) else (
    echo ❌ Backend is not running
)

echo.
echo 4. Testing health endpoint...
curl -s http://127.0.0.1:8000/health
if %errorlevel% equ 0 (
    echo ✅ Backend health check passed
) else (
    echo ❌ Backend health check failed
)

echo.
pause 