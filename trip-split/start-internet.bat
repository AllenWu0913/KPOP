@echo off
cd /d "%~dp0"
if not exist "data\internet.json" (
  echo Please copy internet.example.json to data\internet.json and configure HTTPS first.
  echo See INTERNET.md for setup instructions.
  pause
  exit /b 1
)
python server.py --internet data\internet.json
pause
