# AITM - AI Taekwondo Master

AITM은 태권도 영상을 저장하고 **MediaPipe Pose Landmarker로 실제 관절 좌표를 측정**한 뒤, 프로젝트 기준값과 비교해 점수와 코칭을 제공하는 웹 서비스입니다.

## 현재 핵심 흐름

```text
카메라 촬영 / 영상 업로드
        ↓
Spring Boot 영상 저장
        ↓
FastAPI + MediaPipe Pose
        ↓
무릎 각도 / 골반 회전 / 타이밍 / 착지 안정성 측정
        ↓
Spring 규칙 기반 점수 계산
        ↓
RAG + LLM 코칭(선택)
        ↓
저장 영상 0.25x / 0.5x 재생 + 문제 구간 타임라인
```

LLM은 측정값이나 점수를 임의로 만들지 않습니다. `OPENAI_API_KEY`가 없어도 Pose 분석과 규칙 기반 피드백은 동작하며, 키가 있을 때만 RAG/LLM 코칭을 추가합니다.

## 기술 스택

- Frontend: React 19, Vite, Axios, react-webcam
- Backend: Java 21, Spring Boot 3.4, JPA
- Database: MariaDB 10.11
- Pose AI: Python 3.11, FastAPI, MediaPipe 1.0, OpenCV
- RAG: LangChain, FAISS, OpenAI (optional)
- Runtime: Docker Compose + Nginx

## 실행

1. 환경 파일 생성

```bash
cp .env.example .env
```

Windows에서는 `.env.example`을 `.env`로 복사한 뒤 다음 값을 반드시 변경하세요.

- `AITM_DB_ROOT_PASSWORD`
- `AITM_DB_PASSWORD`
- `RESTOK_AI_SECURE_TOKEN`
- `OPENAI_API_KEY` (RAG 코칭을 사용할 때만)

2. 전체 실행

```bash
docker compose up --build
```

3. 접속

- Web: `http://localhost:5173`
- Spring: `http://localhost:8080`
- AI health: `http://localhost:8000/health`
- MariaDB host port: `3308`

> 카메라 촬영은 브라우저 보안 정책상 `localhost` 또는 HTTPS 환경에서 사용하세요. 외부 도메인으로 배포할 때는 HTTPS가 필요합니다.

## 사용 방법

1. `분석`에서 기술을 선택합니다.
2. 카메라로 최대 20초를 촬영하거나 영상 파일을 선택합니다.
3. `저장하고 평가하기`를 누릅니다.
4. 결과 화면에서 실제 측정값과 점수를 확인합니다.
5. `무릎 수축`, `회전 피크`, `착지` 이벤트를 누르면 해당 시점으로 이동해 0.5배속으로 재생합니다.
6. 필요하면 0.25배속으로 더 느리게 확인합니다.
7. `기록`에서 과거 저장 영상을 다시 열 수 있습니다.

## 분석 지표

현재 MVP는 다음 항목을 실제 Pose 데이터에서 계산합니다.

- 최소 무릎 각도
- 골반 회전 범위
- 추정 회전 각속도
- 어깨-골반 분리 각도
- 상대 점프 높이
- 동작 타이밍
- 착지 안정성
- Pose 검출률 / 분석 신뢰도

> 회전 각속도와 상대 점프 높이는 단일 카메라 Pose 기반 추정치입니다. 모션 캡처 장비나 힘판의 절대 계측값과 동일하다고 주장하지 않습니다.

## 프로젝트 기준값

첫 실행 시 돌개차기/뒤차기/후려차기 기본값을 DB에 넣습니다. 이 값은 **공식 태권도 규정값이 아니라 AITM 프로젝트 기본값**입니다. `기준 관리` 화면에서 실제 지도자 검증값으로 교체하는 것을 권장합니다.

## 영상 저장

업로드 및 카메라 영상은 Docker `video_data` 볼륨에 저장됩니다. Spring은 `/media/**`로 영상을 제공하며 Nginx가 같은 주소로 프록시합니다. 따라서 분석 기록에서 영상 seek와 느린 재생이 가능합니다.

## 원격 URL 분석

원격 URL은 SSRF 방지를 위해 `AITM_ALLOWED_VIDEO_HOSTS`에 등록된 호스트만 허용합니다. 현재 구현은 브라우저에서 직접 접근 가능한 **직접 영상 파일 URL**을 대상으로 합니다.

## 검증

```bash
python VERIFY_SYSTEM.py
```

실제 샘플 영상까지 전체 업로드 → Pose 분석 → 점수 계산 → DB 저장 흐름을 테스트하려면:

```bash
AITM_SAMPLE_VIDEO=/path/to/sample.mp4 python VERIFY_SYSTEM.py
```

## 보안 원칙

- DB 비밀번호/AI 내부 토큰 기본값 없음
- 외부 영상 URL allowlist
- 업로드 확장자 및 500MB 제한
- 서버가 생성한 파일명만 사용해 path traversal 차단
- AI 서비스는 내부 토큰 인증
- 배포 시 프론트는 Nginx를 통해 Spring에 same-origin 접근

## 다음 검증 단계

프로젝트 평가를 더 높이려면 같은 영상에 대한 반복 측정 편차, 지도자가 수동으로 측정한 무릎 각도와 AITM 값의 MAE, 동작 이벤트 시점 오차를 별도 데이터셋으로 기록하는 것이 좋습니다.
