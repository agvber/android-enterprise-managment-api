@echo off
cd /d "%~dp0"
echo.
echo   ================================================
echo   Android Management Console - Setup
echo   ================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('node -v') do echo   [OK] Node.js %%v
) else (
    echo.
    echo   [ERROR] Node.js가 설치되어 있지 않습니다.
    echo.
    echo   https://nodejs.org 에서 다운로드하여 설치해 주세요.
    echo.
    echo   설치 후 이 스크립트를 다시 실행해 주세요.
    echo.
    pause
    exit /b 1
)

:: 2. Install dependencies
echo.
echo   [..] 의존성 설치 중 (npm install)...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] npm install 실패. 위 에러 메시지를 확인해 주세요.
    echo.
    pause
    exit /b 1
)

:: 3. Build
echo.
echo   [..] 빌드 중 (npm run build)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] 빌드 실패. 위 에러 메시지를 확인해 주세요.
    echo.
    pause
    exit /b 1
)

echo.
echo   ================================================
echo   설치 완료!
echo   ================================================
echo.
echo   이제 start.bat를 더블클릭하여 실행하세요.
echo.
pause
