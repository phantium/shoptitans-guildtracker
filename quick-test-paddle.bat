@echo off
echo Testing PaddleOCR in venv...
echo.

venv\Scripts\python.exe -c "from paddleocr import PaddleOCR; print('SUCCESS: PaddleOCR is installed and importable!')"

if errorlevel 1 (
    echo.
    echo FAILED: PaddleOCR not working in venv
    echo.
    echo To fix, run: setup-venv.bat
    pause
    exit /b 1
)

echo.
echo ===================================
echo PaddleOCR is ready to use!
echo ===================================
echo.
echo Now restart the app:
echo   npm start
echo.
echo Then try capturing a player.
echo Check console for detailed error messages.
echo.
pause

