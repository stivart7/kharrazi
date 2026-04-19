@echo off
echo ============================================
echo  Kharrazi - Push vers GitHub
echo ============================================
powershell -ExecutionPolicy Bypass -File "%~dp0push_to_github.ps1"
pause
