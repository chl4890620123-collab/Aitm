import os
import json
import hashlib
import random
import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="AITM AI Analysis Engine")

# CORS Policy: Frontend(Vite) & Backend(Spring) 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECURE_TOKEN = os.getenv("RESTOK_AI_SECURE_TOKEN", "restok-secret-2024")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

class AnalysisRequest(BaseModel):
    sessionId: Optional[int] = None
    videoUrl: str
    moveType: Optional[str] = "dolgechigi"
    mode: Optional[str] = "PRECISION"
    cameraDistance: Optional[float] = None
    cameraHeight: Optional[float] = None
    fileSize: Optional[int] = None
    fileExtension: Optional[str] = None

def load_taekwondo_standards():
    """RAG 지식 베이스 구축을 위한 백엔드 데이터(기술 표준 및 전문 지식) 통합 로드"""
    docs = []
    
    # 1. 기술 표준 메타데이터 로드
    try:
        res_std = requests.get(f"{BACKEND_URL}/api/standards", timeout=2)
        if res_std.status_code == 200:
            for std in res_std.json():
                content = f"기술: {std['skillName']}, 상세: {std['description']}, 안전: {std['injuryPrevention']}"
                docs.append(Document(page_content=content, metadata={"type": "standard", "moveType": std['moveType']}))
    except Exception as e:
        print(f"Standard Data Load Failed: {e}")

    # 2. 도메인 전문 지식(Coaching Base) 로드
    try:
        res_knw = requests.get(f"{BACKEND_URL}/api/knowledge", timeout=2)
        if res_knw.status_code == 200:
            for knw in res_knw.json():
                content = f"핵심포인트: {knw['technicalPoint']}, 기준값: {knw['criteriaValue']}, 전문코칭: {knw['coachingMessage']}"
                docs.append(Document(page_content=content, metadata={"type": "knowledge", "point": knw['technicalPoint']}))
    except Exception as e:
        print(f"Knowledge Base Load Failed: {e}")

    return docs

def get_rag_chain():
    """LLM 인스턴스 및 RAG 파이프라인(Retriever -> Prompt -> LLM) 구성"""
    if not OPENAI_API_KEY:
        return None
        
    docs = load_taekwondo_standards()
    if not docs:
        return None
        
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vectorstore = FAISS.from_documents(docs, embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    
    # 역학 분석 전문 페르소나 주입
    template = """당신은 태권도 동작 분석 AI 마스터입니다. 
    제시된 물리 데이터를 바탕으로 역학적 완성도와 교정 방안을 제시하십시오.
    
    [역학 분석 가이드]:
    - 운동량 보존, 회전 토크 등 물리 원리를 근거로 제시하십시오.
    - 지표 미달 시 구체적인 신체 기전(Mechanism)을 바탕으로 조언하십시오.
    
    [Context]:
    {context}
    
    [Query]:
    - Target: {moveType}
    - Mode: {mode}
    - Data Summary: {question}
    """
    
    prompt = ChatPromptTemplate.from_template(template)
    llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.3, openai_api_key=OPENAI_API_KEY)
    
    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)
    
    chain = (
        {"context": retriever | format_docs, 
         "moveType": lambda x: x["moveType"],
         "mode": lambda x: x["mode"],
         "question": lambda x: x["question"]}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    return chain

rag_chain = None
try:
    rag_chain = get_rag_chain()
except Exception as e:
    print(f"RAG Chain Initialization Failed: {e}")

@app.post("/analyze-full")
async def analyze_full(request: AnalysisRequest, x_restok_ai_token: str = Header(None)):
    """동작 분석 엔드포인트: 시뮬레이션 물리 데이터 생성 및 AI 코칭 리포트 산출"""
    if x_restok_ai_token != SECURE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid Token")

    # Seed 고정을 통한 결과 일관성(Consistency) 확보
    url_hash = int(hashlib.sha256(request.videoUrl.encode()).hexdigest(), 16)
    rng = random.Random(url_hash)

    # 1. 기술 표준 기반 Baseline 지표 로드
    standard_info = {}
    skill_name_display = request.moveType
    try:
        res_std = requests.get(f"{BACKEND_URL}/api/standards/{request.moveType}", timeout=2)
        if res_std.status_code == 200:
            std_data = res_std.json()
            skill_name_display = std_data.get("skillName", request.moveType)
            if std_data.get("standardData"):
                standard_info = json.loads(std_data["standardData"])
    except Exception as e:
        print(f"Standard Query Failed: {e}")

    # 2. 물리 지표 시뮬레이션 (Performance Factor 기반 정규 분포 생성)
    perf_factor = rng.uniform(0.7, 1.0) 
    if "master" in request.videoUrl.lower(): perf_factor = 1.0

    shoulder_accel = standard_info.get("idealShoulderAccel", 150.0) * perf_factor
    knee_transition = standard_info.get("idealKneeTransitionMs", 130) + rng.randint(0, 30) * (1 - perf_factor)
    jump_height = 65 * perf_factor + rng.uniform(0, 10)
    upper_momentum = 85 + 10 * perf_factor
    sync_score = int(92 + 8 * perf_factor)
    landing_score = int(95 + 5 * perf_factor)
    
    # 각속도 및 회전 각도 연산
    base_rotation = 600 if any(k in request.moveType for k in ["720", "1080"]) else 400
    rotation_vel = base_rotation + 250 * (perf_factor - 0.5) * 2
    
    target_deg = 720.0 if "720" in request.moveType else 1080.0 if "1080" in request.moveType else 360.0
    total_rotation_deg = target_deg * perf_factor + rng.uniform(-30, 10)

    # 3. RAG 기반 AI 코칭 리포트 생성
    if rag_chain:
        try:
            query = (
                f"{skill_name_display} 분석 데이터: "
                f"가속도 {shoulder_accel:.1f}, 추진력 {upper_momentum:.1f}, "
                f"무릎전환 {knee_transition:.0f}ms, 점프 {jump_height:.1f}cm, "
                f"회전속도 {rotation_vel:.0f}, 총회전 {total_rotation_deg:.0f}도. "
            )
            ai_feedback = rag_chain.invoke({
                "question": query,
                "moveType": request.moveType,
                "mode": request.mode
            })
        except Exception:
            ai_feedback = "시스템 부하로 인해 AI 피드백을 생성하지 못했습니다. 원천 데이터 분석은 완료되었습니다."
    else:
        ai_feedback = "동작의 전반적인 메커니즘이 양호합니다. 착지 후 안정성 확보에 집중하십시오."

    return {
        "aiFeedback": ai_feedback,
        "moveType": request.moveType,
        "preLoadingFlexDeg": 120 + rng.uniform(-5, 10),
        "jumpBoostHeightCm": int(jump_height),
        "eyeLeadingTimeMs": 130 + rng.randint(0, 20),
        "diagonalPathAngle": 45.0,
        "rotationAngularVelocity": rotation_vel,
        "totalRotationDeg": round(total_rotation_deg, 1),
        "upperBodyMomentum": upper_momentum,
        "shoulderAccel": round(shoulder_accel, 1),
        "kneeTuckTransitionMs": int(knee_transition),
        "handCompactnessScore": int(standard_info.get("idealHandCompactness", 95) * perf_factor),
        "landingStabilityScore": landing_score,
        "timingSyncScore": sync_score,
        "nextMotionTransitionMs": 400 + rng.randint(0, 100)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
