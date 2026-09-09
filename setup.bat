@echo off
echo ================================
echo   YTHelper - Setup Script
echo ================================
echo.

echo [1/4] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (echo ERROR: Root install failed & exit /b 1)
echo Done!

echo.
echo [2/4] Installing server dependencies...
cd server
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (echo ERROR: Server install failed & exit /b 1)
cd ..
echo Done!

echo.
echo [3/4] Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (echo ERROR: Client install failed & exit /b 1)
cd ..
echo Done!

echo.
echo [4/4] Checking for .env file...
if not exist ".env" (
  copy ".env.example" ".env"
  echo IMPORTANT: .env file created from template.
  echo Please open .env and fill in your API keys before starting the server!
) else (
  echo .env already exists. Skipping.
)

echo.
echo ================================
echo  Setup Complete!
echo ================================
echo.
echo NEXT STEPS:
echo  1. Edit .env and add your API keys:
echo     - GROQ_API_KEY     : https://console.groq.com/
echo     - NOMIC_API_KEY    : https://atlas.nomic.ai/
echo     - MONGODB_URI      : https://mongodb.com/atlas (free 512MB)
echo     - LANGSMITH_API_KEY: https://smith.langchain.com/ (free)
echo.
echo  2. Run: npm run dev
echo     This starts both the server (port 5000) and client (port 5173)
echo.
echo  3. Open http://localhost:5173 in your browser
echo.
pause
