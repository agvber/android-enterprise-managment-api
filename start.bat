@echo off
cd /d "%~dp0"
echo.
echo   ================================================
echo   Android Management Console
echo   ================================================
echo.
echo   서버를 시작합니다... 브라우저가 자동으로 열립니다.
echo.
echo   종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo   ================================================
echo.
python server.py
if %errorlevel% neq 0 (
    python3 server.py
)
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Python이 설치되어 있지 않습니다.
    echo   https://www.python.org/downloads/ 에서 설치해 주세요.
    echo.
    pause
)
