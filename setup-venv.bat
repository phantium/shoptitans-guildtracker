@echo off
REM Setup script for Windows - Creates venv and installs PaddleOCR

echo ========================================
echo Shop Titans Guild Tracker - Python Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [1/3] Python found!
python --version
echo.

REM Create virtual environment
echo [2/3] Creating virtual environment...
if exist venv (
    echo Virtual environment already exists, skipping creation
) else (
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
    echo Virtual environment created successfully!
)
echo.

REM Activate and install packages
echo [3/3] Installing PaddleOCR...
echo This will download about 300MB, please be patient...
echo.

call venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install packages
    echo Try running manually:
    echo   venv\Scripts\activate.bat
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Setup complete!
echo ========================================
echo.
echo Virtual environment created at: %CD%\venv
echo.
echo To test the setup, run:
echo   node test-python-setup.js
echo.
echo Then build and start the app:
echo   npm run build
echo   npm start
echo.
pause

