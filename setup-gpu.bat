@echo off
REM Setup GPU acceleration for PaddleOCR

echo ========================================
echo PaddleOCR GPU Setup
echo ========================================
echo.

REM Check if venv exists
if not exist venv (
    echo ERROR: Virtual environment not found!
    echo Please run setup-venv.bat first
    pause
    exit /b 1
)

echo Checking NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: nvidia-smi not found!
    echo Make sure you have:
    echo   1. NVIDIA GPU
    echo   2. NVIDIA drivers installed
    echo   3. CUDA Toolkit installed
    echo.
    echo If you have an NVIDIA GPU, install:
    echo   - NVIDIA drivers: https://www.nvidia.com/download/index.aspx
    echo   - CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
    echo.
    pause
    exit /b 1
)

echo.
echo GPU detected! Installing GPU-enabled PaddlePaddle...
echo.

call venv\Scripts\activate.bat

echo.
echo [1/2] Uninstalling CPU version...
pip uninstall -y paddlepaddle

echo.
echo [2/2] Installing GPU version...
echo This may take a few minutes...
echo.

REM Install CUDA 11.x version (most compatible)
pip install paddlepaddle-gpu==3.2.2 -i https://www.paddlepaddle.org.cn/packages/stable/cu118/

if errorlevel 1 (
    echo.
    echo ERROR: GPU installation failed
    echo.
    echo Reinstalling CPU version...
    pip install paddlepaddle
    echo.
    echo GPU setup failed, but CPU version restored.
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! GPU acceleration enabled!
echo ========================================
echo.
echo Testing GPU...
python -c "import paddle; print(f'GPU available: {paddle.device.cuda.device_count()} device(s)')"
echo.
echo Next steps:
echo   1. Restart the app: npm start
echo   2. Capture a player
echo   3. Check console for: "GPU initialization successful!"
echo.
echo Expected speed improvement:
echo   - Before (CPU): 2-3 seconds
echo   - After (GPU):  0.5-1 second ⚡
echo.
pause

