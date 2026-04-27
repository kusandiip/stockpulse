@echo off
setlocal
echo.
echo  StockPulse v3.0 - Starting Platform
echo.
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%backend"
if not exist venv ( python -m venv venv )
call venv\Scripts\activate.bat
pip install --upgrade pip setuptools wheel -q
pip install -r requirements.txt -q
cd /d "%SCRIPT_DIR%frontend"
call npm install --silent
echo.
echo  Frontend  -^>  http://localhost:3000
echo  Backend   -^>  http://localhost:8000
echo  API Docs  -^>  http://localhost:8000/docs
echo.
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000"') do taskkill /f /pid %%a 2>nul
cd /d "%SCRIPT_DIR%backend"
start "StockPulse Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
cd /d "%SCRIPT_DIR%frontend"
start "StockPulse Frontend" cmd /k "npm run dev"
echo  Both servers launching in separate windows.
pause >nul
