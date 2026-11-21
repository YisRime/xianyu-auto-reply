@echo off
chcp 65001 >nul
echo 正在停止闲鱼自动回复系统 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
echo 已停止。
timeout /t 4 /nobreak >nul
exit