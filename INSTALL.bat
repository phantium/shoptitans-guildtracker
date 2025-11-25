@echo off
echo ========================================
echo Shop Titans Guild Tracker - Installation
echo ========================================
echo.

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo [2/5] Rebuilding native modules for Electron...
call npx electron-rebuild
if errorlevel 1 (
    echo ERROR: Failed to rebuild native modules
    pause
    exit /b 1
)
echo.

echo [3/5] Building React application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build application
    pause
    exit /b 1
)
echo.

echo [4/5] Creating data directories...
if not exist "data" mkdir data
if not exist "exports" mkdir exports
echo.

echo [5/5] Setting up Python environment...
call setup-venv.bat
if errorlevel 1 (
    echo ERROR: Failed to setup Python environment
    pause
    exit /b 1
)
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the application, run: npm start
echo Or double-click START.bat
echo.
pause

