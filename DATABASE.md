# AITM Database Schema Document (MariaDB)

본 문서는 AITM 플랫폼의 핵심 데이터 구조를 정의합니다. 정형 데이터(MariaDB)와 비정형 데이터(FAISS Vector DB)의 역할을 상세히 기술합니다.

---

## 1. 정형 데이터베이스 (MariaDB)

### 📊 `analysis_results` (분석 결과 테이블)
수련자의 개별 발차기 분석 결과와 AI 피드백을 저장합니다.

| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `result_id` | BIGINT (PK) | 자동 생성 일련번호 |
| `session_id` | BIGINT (FK) | `analysis_sessions` 테이블 참조 |
| `video_url` | VARCHAR | 분석에 사용된 영상 파일 경로 또는 URL |
| `move_type` | VARCHAR | 분석 대상 기술 (예: dolgechigi, kick_720) |
| `total_score` | INT | 역학 지표를 종합하여 산출한 최종 점수 |
| `ai_feedback` | TEXT | OpenAI RAG 엔진이 생성한 마스터 코칭 메시지 |
| **[운동 역학 지표]** | | |
| `shoulder_accel` | DOUBLE | 어깨 회전 가속도 (rad/s²) |
| `upper_body_momentum` | DOUBLE | 상체 추진력 (kg·m/s) |
| `jump_boost_height_cm` | INT | 도약 시 지면 반발력을 통한 점프 높이 |
| `rotation_angular_velocity` | DOUBLE | 회전 시의 각속도 (deg/s) |
| `total_rotation_deg` | DOUBLE | 전체 회전 각도 (예: 720.0) |
| `knee_tuck_transition_ms` | INT | 무릎을 접어 회전 반경을 줄이는 속도 |
| `timing_sync_score` | INT | 시선 선행과 타격 시점의 일치율 (0~100) |
| `landing_stability_score` | INT | 착지 시 중심 이동 및 안정성 점수 |

### 📖 `technical_standards` (기술 표준 테이블)
태권도 교본 기반의 기술별 '정석' 물리 지표를 저장합니다.

| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `standard_id` | BIGINT (PK) | 고유 번호 |
| `move_type` | VARCHAR (UK) | 기술 고유 코드 |
| `skill_name` | VARCHAR | 한글 기술명 (예: 돌개차기) |
| `standard_data` | TEXT (JSON) | 목표 가속도, 목표 각속도 등 정교한 기준값 |
| `description` | TEXT | 기술의 역학적 원리 설명 |
| `injury_prevention` | TEXT | 해당 기술 수련 시 주의해야 할 부상 방지 수칙 |

---

## 2. 비정형 데이터베이스 (FAISS Vector DB)

AI 엔진(FastAPI) 내부에 탑재되어 있으며, RAG(Retrieval-Augmented Generation) 프로세스에 사용됩니다.

- **데이터 소스:** `technical_standards` 테이블의 텍스트 정보 + 태권도 전문 지식(`TaekwondoKnowledge`)
- **역할:** 사용자의 수치를 보고 AI가 조언을 할 때, 단순한 숫자가 아니라 **"교본의 몇 페이지에 따르면..."** 과 같은 근거 있는 코칭을 생성하기 위한 검색 엔진 역할을 합니다.

---

## 3. 데이터 흐름 요약
1. **입력:** 사용자 영상 → **UI**
2. **가공:** 영상 속 물리 수치 추출 → **AI 엔진**
3. **대조:** 추출 수치 vs **`technical_standards`** (MariaDB) & **벡터 지식** (FAISS)
4. **결과:** 최종 점수 및 코칭 생성 → **`analysis_results`** (MariaDB) 저장
