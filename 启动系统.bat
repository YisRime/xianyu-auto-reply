@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "PLAYWRIGHT_BROWSERS_PATH=%ROOT%\runtime\browsers"
set "PATCHRIGHT_BROWSERS_PATH=%ROOT%\runtime\browsers"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
title 闲鱼自动回复系统
echo ============================================
echo    闲鱼自动回复系统 - 一键启动
echo ============================================
echo.
echo [1/4] 启动 MySQL ...
start "xianyu-mysql" /min /d "%ROOT%\runtime\mysql\bin" "%ROOT%\runtime\mysql\bin\mysqld.exe" --defaults-file="%ROOT%\runtime\my.ini" --console
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 3306 -TimeoutSec 90 >nul
echo [2/4] 启动 Backend-Web (含前端页面) ...
start "xianyu-backend-web" /min /d "%ROOT%\backend-web" ".venv\Scripts\python.exe" main.py
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 8089 -TimeoutSec 240 >nul
echo [3/4] 启动 WebSocket / Scheduler ...
start "xianyu-websocket" /min /d "%ROOT%\websocket" ".venv\Scripts\python.exe" main.py
start "xianyu-scheduler" /min /d "%ROOT%\scheduler" ".venv\Scripts\python.exe" main.py
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 8090 -TimeoutSec 120 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 8091 -TimeoutSec 120 >nul
echo [4/4] 打开管理后台 ...
start "" "http://127.0.0.1:8089"
echo.
echo --------------------------------------------------
echo  管理后台: http://127.0.0.1:8089
echo  默认账号: admin / admin123
echo  停止服务: 双击 停止系统.bat
echo --------------------------------------------------
timeout /t 8 /nobreak >nul
exit