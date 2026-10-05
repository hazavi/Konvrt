@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules call npm install || exit /b 1

rem Open the browser shortly after the dev server starts.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:4321"

call npm run dev:astro
endlocal
