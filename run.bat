@echo off
setlocal enabledelayedexpansion

title BioCrystal 3D Launcher

echo ========================================================
echo   BIOCRYSTAL 3D: DNA MUTATION ANALYSIS WORKSTATION
echo ========================================================
echo.

cd /d "%~dp0"

:: --------------------------------------------------------------------------
:: 1. Detect Python Interpreter
:: --------------------------------------------------------------------------
set PYTHON_EXE=

if exist ".venv\Scripts\python.exe" (
    echo [INFO] Detected active virtual environment in .venv
    set "PYTHON_EXE=.venv\Scripts\python.exe"
    goto PYTHON_FOUND
)

python -c "import sys; sys.exit(0)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=python"
    goto PYTHON_FOUND
)

py -3.14 -c "import sys; sys.exit(0)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=py -3.14"
    goto PYTHON_FOUND
)

py -c "import sys; sys.exit(0)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=py"
    goto PYTHON_FOUND
)

echo [ERROR] No working Python installation found!
echo Please install Python 3.10+ and add it to your PATH.
pause
exit /b 1

:PYTHON_FOUND
echo [INFO] Using Python interpreter: %PYTHON_EXE%

:: --------------------------------------------------------------------------
:: 2. Verify and Install Backend Dependencies
:: --------------------------------------------------------------------------
echo [INFO] Verifying backend dependencies (fastapi, uvicorn, biopython, reportlab)...
%PYTHON_EXE% -c "import fastapi, uvicorn, Bio, reportlab" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARN] Required dependencies missing. Installing from backend\requirements.txt...
    %PYTHON_EXE% -m pip install -r backend\requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install backend dependencies!
        pause
        exit /b 1
    )
    echo [OK] Backend dependencies installed successfully.
) else (
    echo [OK] All required backend dependencies are verified.
)

:: --------------------------------------------------------------------------
:: 3. Port Conflict & Process Check (Port 8000)
:: --------------------------------------------------------------------------
set BACKEND_RUNNING=0
curl.exe -s --max-time 1 http://127.0.0.1:8000/api/health | findstr /i "healthy" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] FastAPI backend is ALREADY running and healthy at http://127.0.0.1:8000
    set BACKEND_RUNNING=1
) else (
    netstat -ano | findstr :8000 | findstr /i "LISTENING" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [WARN] Port 8000 is occupied by an external process.
        echo Attempting to proceed or restart if necessary.
    )
)

:: --------------------------------------------------------------------------
:: 4. Launch Backend if Not Running
:: --------------------------------------------------------------------------
if %BACKEND_RUNNING% equ 0 (
    echo [INFO] Starting FastAPI Biopython Backend on http://127.0.0.1:8000...
    start "BioCrystal Backend (FastAPI)" cmd /k "title BioCrystal Backend && cd /d "%~dp0" && %PYTHON_EXE% -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
)

:: --------------------------------------------------------------------------
:: 5. Port Conflict & Process Check (Port 5173 - Frontend)
:: --------------------------------------------------------------------------
set FRONTEND_RUNNING=0
netstat -ano | findstr :5173 | findstr /i "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Vite frontend is ALREADY listening on port 5173
    set FRONTEND_RUNNING=1
) else (
    echo [INFO] Starting Vite React Three.js Frontend on http://127.0.0.1:5173...
    start "BioCrystal Frontend (Vite)" cmd /k "title BioCrystal Frontend && cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5173"
)

:: --------------------------------------------------------------------------
:: 6. Health Check Wait Loop (Polling /api/health)
:: --------------------------------------------------------------------------
echo [INFO] Waiting for FastAPI backend health check to report ONLINE...
set ATTEMPTS=0
:POLL_LOOP
set /a ATTEMPTS+=1
timeout /t 1 /nobreak >nul
curl.exe -s --max-time 2 http://127.0.0.1:8000/api/health | findstr /i "healthy" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    goto BACKEND_ONLINE
)
if %ATTEMPTS% geq 15 (
    goto BACKEND_TIMEOUT
)
goto POLL_LOOP

:BACKEND_ONLINE
echo.
echo ========================================================
echo   BIOCRYSTAL 3D: WORKSTATION IS ONLINE
echo ========================================================
echo   - Web Application:    http://127.0.0.1:5173/
echo   - FastAPI Backend:    http://127.0.0.1:8000/
echo   - Backend Health:     http://127.0.0.1:8000/api/health
echo   - Interactive API:    http://127.0.0.1:8000/docs
echo ========================================================
echo [OK] Both services are running in their respective windows.
echo Keep this window open or press any key to close launcher.
pause >nul
exit /b 0

:BACKEND_TIMEOUT
echo.
echo ========================================================
echo   [ERROR] BACKEND STARTUP TIMEOUT
echo ========================================================
echo The FastAPI backend at http://127.0.0.1:8000 did not report
echo healthy within 15 seconds.
echo.
echo Please switch to the "BioCrystal Backend (FastAPI)" window
echo to inspect any startup exceptions or tracebacks.
echo ========================================================
pause
exit /b 1
