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

## 사범 개인 훈련 흐름

10년 이상 수련한 사범이 지도자 없이 혼자 기술을 연습하는 상황을 중심으로 구성했습니다.

1. **기술 배우기:** 지도자 또는 관리자가 이미 등록한 기술 설명·주의사항·버전·검증 상태·유튜브 시범 영상을 확인합니다. 기존 기준 데이터는 유지됩니다.
2. **내 영상 가져오기:** 휴대폰 촬영 또는 저장된 영상 파일을 선택합니다. 모바일에서는 브라우저에서 제공하는 기본 카메라를 우선 사용합니다.
3. **비교할 원본 영상(선택):** 사용 권한이 있는 원본 MP4/MOV 등을 추가하면 AITM의 **같은 MediaPipe Pose 분석**을 두 영상에 각각 적용합니다. 유튜브 시청 URL은 임베드 참고용일 뿐 자동 다운로드/직접 Pose 분석을 하지 않습니다.
4. **분석 방식 선택:** 기본 `PRECISION`은 기존 표본 빈도(최대 15fps/30초, 환경 변수에 따름)와 기존 Python 측정·Java 점수 계산을 유지합니다. `FAST`는 최대 10fps/20초의 영상 표본과 규칙 기반 코칭으로 대기시간을 줄이는 선택형 미리보기이며 정확한 타이밍 평가에 쓰지 않습니다.
5. **근거 동작 확인:** 무릎 각도·추정 회전 각속도 그래프를 실제 측정 시점과 연동합니다. 영상 타임라인을 손가락으로 밀어 프레임을 살펴보고 놓으면 천천히 재생됩니다.
6. **기준과 비교:** 원본 파일이 있으면 양쪽의 실제 측정값과 같은 이름의 동작 이벤트를 표시합니다. 촬영 시점과 몸의 조건이 다를 수 있으므로 **차이값을 기술의 우열이나 정확성으로 판정하지 않습니다.**
7. **훈련 반복:** 분석 기록을 본인 계정에서 다시 확인하고, 지도자가 검증한 기술 기준을 참고해 다음 영상을 촬영합니다.

## 기존 평가·데이터 유지

- 사용자 Pose 기반 무릎·회전·타이밍·착지와 최종 Java 점수의 계산 로직은 변경하지 않았습니다.
- 기준 선택은 분석 시작 시 한 번 확정해 Python 측정과 Java 점수에 동일하게 사용하며, 기준 버전·출처 스냅샷을 결과에 남깁니다.
- 등록된 기술/지식 데이터와 기존 분석 결과는 그대로 사용합니다. 원본 비교 영상은 추가 파일로 저장하며 제거·탈퇴 시 함께 정리합니다.
- 단일 카메라 추정값은 측정 장비의 절대적인 역학 성능이나 전문 지도자의 판정과 같지 않습니다.
- 신규 기술의 기준값은 관리자가 등록하며, 검증 전 기준은 명시적으로 표시합니다.

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
