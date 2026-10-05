@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules call npm install || exit /b 1

rem Starts the Astro dev server and Electron together; closing Electron stops both.
call npm start
endlocal
