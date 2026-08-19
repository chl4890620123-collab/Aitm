# AITM (AI Taekwondo Master)

카메라 녹화, 파일 업로드 또는 허용된 직접 영상 URL에서 자세 랜드마크를 추출하고 태권도 기술 피드백을 제공하는 플랫폼입니다.

## 영상 정책

- 카메라 및 사용 허가된 파일은 영속 영상 디렉터리에 저장됩니다.
- YouTube URL은 공식 임베드 플레이어를 통한 참조 재생만 지원하며 다운로드하거나 학습 데이터로 복제하지 않습니다.
- 외부 직접 영상 URL 분석은 `RESTOK_VIDEO_ALLOWED_HOSTS`에 등록된 호스트만 허용됩니다.
- 협회 영상을 분석 데이터로 사용하려면 권리자로부터 별도 허가받은 원본 파일을 업로드하십시오.

## Windows Docker Desktop 배포

1. `.env.example`을 `.env`로 복사합니다.
2. `AITM_APP_USERNAME`, `AITM_APP_PASSWORD`, `RESTOK_DB_PASSWORD`, `RESTOK_AI_SECURE_TOKEN`, `RESTOK_VIDEO_SIGNING_KEY`, `OPENAI_API_KEY`를 설정합니다.
3. 기본 저장 위치는 `C:/AITM/data`입니다. 다른 위치는 `AITM_DATA_ROOT`로 변경합니다.
4. 실행합니다.

```powershell
docker compose up --build -d
docker compose ps
```

- 웹: `http://localhost:5173`
- API: `http://localhost:8080`
- DB 데이터: `C:\AITM\data\mariadb`
- 녹화 및 업로드 영상: `C:\AITM\data\videos`

웹과 `/api`는 HTTP Basic 인증으로 보호됩니다. MariaDB, Spring, FastAPI 포트는 호스트에 공개되지 않으며 Docker 내부 네트워크에서만 통신합니다.

## 분석과 점수

FastAPI가 OpenCV와 MediaPipe로 프레임별 포즈 랜드마크를 추출합니다. 최종 점수는 회전속도를 사용하지 않습니다.

- 어깨 가속도 20%
- 상체 추진력 20%
- 손발 동작 동기화 30%
- 착지 안정성 30%

측정할 수 없는 지표는 제외하고 남은 가중치를 재정규화합니다. 현재 수치는 단안 카메라 정규화 좌표 기반이므로 공식 평가에 사용하기 전 촬영 거리, 신체 치수 및 검증 데이터셋을 통한 보정이 필요합니다.

## 근거 기반 RAG

기술 표준과 코칭 지식을 MariaDB API에서 읽고 Docker 내부에서 먼저 검색합니다. `ALLOW_OPENAI_EGRESS=true`일 때만 검색된 최소 근거와 측정 수치를 OpenAI에 보내며 원본 영상과 이미지는 보내지 않습니다. OpenAI가 비활성화되거나 실패하면 로컬 검색·규칙 엔진이 자동으로 코칭을 생성합니다. 관련 근거 ID가 응답에 포함되고 지식 캐시는 `RAG_CACHE_SECONDS` 주기로 갱신됩니다.
