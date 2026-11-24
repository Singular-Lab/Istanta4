@echo off
rem monta-cliente.cmd - lancia monta-cliente.ps1 senza fermarsi sull'execution policy. Uso: monta-cliente Edro21
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0monta-cliente.ps1" %*
exit /b %ERRORLEVEL%
