@echo off
cd /d "%~dp0"
python server.py --lan %*
if errorlevel 1 pause
