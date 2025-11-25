@echo off
echo ========================================
echo  Shop Titans Guild Tracker - Build Script
echo ========================================
echo.

echo [1/4] Building React frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo Frontend build complete!
echo.

echo [2/4] Creating CPU version executables...
echo This may take 2-5 minutes...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set CSC_LINK=
call npx electron-builder --config electron-builder-cpu.json
if %errorlevel% neq 0 (
    echo ERROR: CPU build failed!
    pause
    exit /b 1
)
echo CPU version complete!
echo.

echo [3/4] Creating GPU version executables...
echo This may take 2-5 minutes...
call npx electron-builder --config electron-builder-gpu.json
if %errorlevel% neq 0 (
    echo ERROR: GPU build failed!
    pause
    exit /b 1
)
echo GPU version complete!
echo.

echo [4/4] Build complete!
echo.
echo ========================================
echo  BUILD SUCCESSFUL!
echo ========================================
echo.
echo Your executables are in the "release" folder:
echo.
echo CPU VERSION (release/cpu/):
echo   - Shop Titans Guild Tracker CPU Setup 1.0.0.exe
echo   - Shop Titans Guild Tracker CPU-1.0.0-portable.exe
echo   - Includes: setup-venv.bat (CPU-only PaddleOCR)
echo.
echo GPU VERSION (release/gpu/):
echo   - Shop Titans Guild Tracker GPU Setup 1.0.0.exe
echo   - Shop Titans Guild Tracker GPU-1.0.0-portable.exe
echo   - Includes: setup-venv.bat ^& setup-gpu.bat (GPU acceleration)
echo.
echo You can now upload these files to GitHub releases.
echo.
pause




