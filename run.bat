@echo off
echo ========================================================
echo   BIOCRYSTAL 3D: DNA MUTATION SIMULATION ENGINE
echo ========================================================
echo Starting FastAPI Biopython Backend (Port 8000)...
start "BioCrystal Backend" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo Starting Vite React Three.js Frontend (Port 5173)...
start "BioCrystal Frontend" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo Application initialized!
echo - Web UI: http://127.0.0.1:5173/
echo - REST API Documentation: http://127.0.0.1:8000/docs
echo ========================================================

