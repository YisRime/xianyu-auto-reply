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
echo    闲鱼自动回复系统 - 一键启动（后台运行）
echo ============================================
echo.
echo [1/2] 启动 Backend-Web（含前端页面与定时任务）...
powershell -NoProfile -Command "Start-Process -FilePath '%ROOT%\.venv\Scripts\python.exe' -ArgumentList 'main.py' -WorkingDirectory '%ROOT%\backend-web' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\logs\backend-web.out.log' -RedirectStandardError '%ROOT%\logs\backend-web.err.log'"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 8089 -TimeoutSec 300 >nul
echo [2/2] 启动 WebSocket ...
powershell -NoProfile -Command "Start-Process -FilePath '%ROOT%\.venv\Scripts\python.exe' -ArgumentList 'main.py' -WorkingDirectory '%ROOT%\websocket' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\logs\websocket.out.log' -RedirectStandardError '%ROOT%\logs\websocket.err.log'"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-port.ps1" -Port 8090 -TimeoutSec 120 >nul
start "" "http://127.0.0.1:8089"
echo.
echo --------------------------------------------------
echo  管理后台: http://127.0.0.1:8089
echo  默认账号: admin / admin123
echo  数据文件: data\xianyu.db（SQLite，无需数据库服务）
echo  停止服务: 双击 停止系统.bat
echo --------------------------------------------------
timeout /t 10 /nobreak >nul
exit