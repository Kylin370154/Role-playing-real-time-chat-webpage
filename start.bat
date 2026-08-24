@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  �?     意笼精神病院 · 角色扮演系统       �?
echo  �?   CHENXI PSYCHIATRIC HOSPITAL RP    �?
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [*] 正在启动服务器，浏览器将自动打开...
    echo  [*] Ctrl+C 可停止服务器
    echo.
    python server.py
) else (
    echo  [!] 未检测到 Python，请先安装 Python 3
    echo  [!] 下载地址: https://www.python.org/downloads/
    echo.
    pause
)
