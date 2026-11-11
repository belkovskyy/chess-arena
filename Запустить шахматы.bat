@echo off
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2> nul
if errorlevel 1 (
  echo Node.js не найден. Установи Node.js 18 или новее и повтори запуск.
  pause
  exit /b 1
)
if not exist "node_modules\chess.js\dist\esm\chess.js" (
  echo Устанавливаю зависимость для шахматной доски...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" http://127.0.0.1:4173
call npm start
pause
