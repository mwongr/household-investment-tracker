@echo off
cd /d "%~dp0"
echo Starting Household Investment Tracker...
echo.
echo ---------------------------------------------------------------
echo  APP RUNNING. Press Ctrl+C to stop.
echo  IMPORTANT: If asked "Terminate batch job (Y/N)?", TYPE N.
echo  This will allow the backup script to run.
echo ---------------------------------------------------------------
echo.
call npm run dev

echo.
echo ---------------------------------------------------------------
:ask_backup
set /p "target_folder=Do you want to run a backup now? (y/n): "
if /i "%target_folder%"=="y" (
    echo.
    echo Running Backup Process...
    node server/backup.js
    echo.
    echo Done.
    pause
    exit
)
if /i "%target_folder%"=="n" (
    exit
)
goto ask_backup
