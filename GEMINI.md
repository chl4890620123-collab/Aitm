# Project Instructions (AITM)

이 파일은 AITM 프로젝트의 아키텍처 설계 원칙과 개발 가이드를 정의합니다. 모든 팀원은 새로운 기능을 추가하거나 수정할 때 이 규칙을 준수해야 합니다.

## 🏛️ 아키텍처 원칙

### 1. 계층 간 역할 분리 (SOC)
- **Frontend:** 순수 UI 및 사용자 입력 처리. 복잡한 분석 로직은 백엔드에 위임합니다.
- **Spring Boot:** 'Single Source of Truth'. 모든 데이터의 영속화(DB 저장)와 외부 AI 서비스와의 오케스트레이션을 담당합니다.
- **AI Service:** 무거운 계산 및 AI 추론 전문화. 자체적인 영속성 컨텍스트(MariaDB)를 가지지 않으며, 결과는 항상 백엔드를 통해 저장합니다.

### 2. 보안 및 통신 규칙
- **Zero-Exposure Policy:** 백엔드와 AI 서비스 간의 통신은 반드시 `RESTOK_AI_SECURE_TOKEN`을 헤더에 포함해야 합니다.
- **Frontend API Config:** 프론트엔드는 `VITE_API_BASE_URL` 환경 변수를 사용하여 백엔드 주소를 관리합니다. (기본값: `http://localhost:8080`)
- **CORS 설정:** 프론트엔드(`:5173`), 백엔드(`:8080`), AI 서비스(`:8000`) 간의 허용된 통신 범위를 엄격히 관리합니다.

### 3. 데이터 설계 규칙
- **물리 지표 표준화:** `AnalysisResult` 엔티티에 저장되는 모든 물리 수치(각도, 속도, 시간 등)는 기술 표준(`TechnicalStandard`)에서 정의한 단위를 따릅니다.
- **RAG 지식 베이스:** AI 서비스의 지식 베이스는 백엔드의 `/api/standards` 및 `/api/knowledge` API를 통해 동적으로 로드됩니다.

## 🛠️ 개발 워크플로우

### 분석 시나리오 추가 시
1. `TechnicalStandard` 테이블에 새로운 기술의 물리 기준값 등록
2. AI 서비스(`main.py`)의 `load_taekwondo_standards`에서 해당 기술 인식 여부 확인
3. 프론트엔드 `AnalysisEngine.jsx`에 해당 기술 선택 옵션 추가

## 🚨 주의 사항
- DB 포트는 기본 `3306`이 아닌 `3308`을 사용합니다 (MariaDB 로컬 충돌 방지).
- 모든 환경 변수(`OPENAI_API_KEY` 등)는 소스 코드에 하드코딩하지 않고 `.env` 또는 `application.properties`의 외부 주입 기능을 사용합니다.
