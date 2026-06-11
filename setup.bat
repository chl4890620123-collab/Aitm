@echo off
echo ==================================================
echo   🥋 AITM System Setup (Windows)
echo ==================================================

if not exist .env (
    echo [INFO] .env 파일이 없습니다. .env.example을 복사하여 생성합니다.
    copy .env.example .env
    echo [WARN] .env 파일을 열어 OPENAI_API_KEY를 입력해 주세요!
)

echo [INFO] Docker Compose를 통해 시스템을 빌드하고 실행합니다...
docker-compose up --build -d

echo.
echo ==================================================
echo   🚀 시스템 기동 중...
echo ==================================================
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:8080
echo   - AI Engine: http://localhost:8000
echo ==================================================
echo.
echo [HINT] 시스템 상태를 점검하려면 'python VERIFY_SYSTEM.py'를 실행하세요.
pause
