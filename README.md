# AITM - AI Taekwondo Master

AITM은 태권도 영상을 저장하고 **MediaPipe Pose Landmarker로 실제 관절 좌표를 측정**한 뒤, 프로젝트 기준값과 비교해 점수와 코칭을 제공하는 웹 서비스입니다.

## 핵심 가치

AITM은 LLM이 영상을 보고 임의로 점수를 만드는 구조가 아닙니다.

```text
카메라 촬영 / 영상 업로드
        ↓
Spring Boot 영상 저장
        ↓
FastAPI + MediaPipe Pose
        ↓
관절 좌표 / 무릎 각도 / 회전 / 타이밍 / 착지 측정
        ↓
촬영 신뢰도 검사
        ↓
Spring 규칙 기반 점수
        ↓
기준 버전·출처 스냅샷 저장
        ↓
RAG + LLM 코칭(선택)
        ↓
영상 위 Pose 오버레이 + 문제 시점 느린 재생
```

## 평가 신뢰성

- 분석 신뢰도 55% 미만: 최종 점수를 발급하지 않고 `LOW_CONFIDENCE` 처리
- 분석 신뢰도 55~69%: `REVIEW_REQUIRED` 처리
- 분석 신뢰도 70% 이상: `COMPLETED`
- 점수는 무릎 25%, 회전 30%, 타이밍 20%, 착지 15%, 촬영 신뢰도 10%
- 결과에는 점수 세부 근거와 당시 사용한 기준 버전/출처를 스냅샷으로 저장
- 기준값은 기본적으로 프로젝트 기준이며, 관리자 화면에서 실제 지도자 검증값과 출처로 교체 가능
- 단일 카메라 기반 회전속도와 점프는 상대/추정 지표이며 계측 장비 절대값으로 주장하지 않음

## 사용자 흐름

1. 분석 기술 선택
2. 카메라 촬영 또는 영상 업로드
3. `저장하고 평가하기`
4. Pose 분석 및 촬영 품질 검사
5. 결과 화면에서 관절 오버레이 확인
6. 부족한 이벤트 클릭
7. 해당 시점으로 이동하여 0.25x 또는 0.5x 느린 재생
8. 점수 근거와 RAG 코칭 확인
9. History에서 당시 기준 버전과 함께 다시 확인

## 기술 스택

- Frontend: React 19, Vite, Axios, react-webcam
- Backend: Java 21, Spring Boot 3.4, JPA
- Database: MariaDB 10.11
- Pose AI: Python 3.11, FastAPI, MediaPipe, OpenCV
- RAG: LangChain, FAISS, OpenAI (optional)
- Runtime: Docker Compose + Nginx

## 실행

`.env.example`을 `.env`로 복사하고 다음 값을 변경합니다.

```env
AITM_DB_ROOT_PASSWORD=change-me
AITM_DB_PASSWORD=change-me
RESTOK_AI_SECURE_TOKEN=change-this-long-random-token
OPENAI_API_KEY=
AITM_ALLOWED_VIDEO_HOSTS=storage.googleapis.com
```

실행:

```bash
docker compose up --build
```

접속:

- Web: `http://localhost:5173`
- Spring API: `http://localhost:8080`
- AI health: `http://localhost:8000/health`
- MariaDB host port: `3308`

> 브라우저 카메라는 localhost 또는 HTTPS 환경에서 사용하세요. 실제 도메인 배포에서는 HTTPS 구성이 필요합니다.

## 테스트

```bash
cd demo
./mvnw test

cd ../front
npm ci
npm run build

cd ../demo/ai
python -m compileall -q .
```

Docker 전체 진단:

```bash
python VERIFY_SYSTEM.py
```

샘플 영상까지 전체 업로드 → Pose 분석 → 점수 계산 → DB 저장 흐름을 검사하려면:

```bash
AITM_SAMPLE_VIDEO=/path/to/sample.mp4 python VERIFY_SYSTEM.py
```

## 현재 MVP 측정값

- 최소 무릎 각도
- 골반 회전 범위
- 영상 기반 추정 회전 각속도
- 어깨-골반 분리각
- 상대 수직 이동량
- 무릎 수축 ↔ 회전 피크 타이밍
- 착지 안정성
- Pose 검출률 / 분석 신뢰도

## 다음 검증 단계

프로젝트의 최종 품질은 코드보다 **기준 데이터 검증**에 의해 더 올라갑니다.

1. 동일 촬영 조건으로 지도자/숙련자 기준 영상 수집
2. 사람이 직접 확인한 주요 이벤트 시점과 AITM 결과 비교
3. 무릎 각도 MAE, 이벤트 시점 MAE, 반복 분석 편차 기록
4. 기준값 버전 업 및 출처 등록
5. 좋은 동작/부족한 동작 샘플을 시연 데이터로 고정

이 과정을 거치면 AITM을 단순 AI 데모가 아니라 **측정 근거가 남는 태권도 코칭 보조 시스템**으로 설명할 수 있습니다.
