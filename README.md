# AITM (AI Taekwondo Master)

태권도 동작 분석 및 기술 지식 관리 플랫폼입니다. AI를 활용하여 수련자의 동작을 분석하고, 운동 역학 기반의 전문적인 피드백을 제공합니다.

## 🏗️ 시스템 아키텍처

본 프로젝트는 3계층 마이크로서비스 아키텍처로 구성되어 있습니다. 상세 구조는 [ARCHITECTURE.html](./ARCHITECTURE.html) 파일을 참고하세요.

1.  **Client Zone (React PWA):** 사용자 인터페이스 및 분석 엔진 UI (`/front`)
2.  **Core Backend (Spring Boot):** 비즈니스 로직 및 데이터 관리 (`/demo`)
3.  **AI Service (FastAPI):** LangChain RAG 기반 동작 분석 및 코칭 생성 (`/demo/ai`)

## 🚀 시작하기

### Prerequisites
- Java 17+
- Node.js 18+
- Python 3.9+
- MariaDB

### 서비스별 기동 방법

#### 1. MariaDB 설정
- 포트: `3308`
- DB명: `restok_db`
- 사용자/암호: `root` / `1234` (또는 환경변수 설정)

#### 2. Core Backend (Spring Boot)
```bash
cd demo
./mvnw spring-boot:run
```
- API 주소: `http://localhost:8080`

#### 3. AI Service (FastAPI)
```bash
cd demo/ai
pip install -r requirements.txt
python main.py
```
- API 주소: `http://localhost:8000`
- 환경변수 필요: `OPENAI_API_KEY`, `RESTOK_AI_SECURE_TOKEN`

#### 4. Frontend (React)
```bash
cd front
npm install
npm run dev
```
- 웹 주소: `http://localhost:5173`

## 🛠️ 주요 기술 스택
- **Frontend:** React, Vite, Axios, TailwindCSS (추천)
- **Backend:** Spring Boot, JPA, MariaDB, REST API
- **AI Engine:** FastAPI, LangChain, OpenAI GPT-4o-mini, FAISS (Vector DB)

## 📄 문서
- [시스템 아키텍처 다이어그램](./ARCHITECTURE.html)
- [프로젝트 개발 규칙](./GEMINI.md)
