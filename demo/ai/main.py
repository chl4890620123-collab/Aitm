import os
import time
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np
import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

app = FastAPI(title="AITM AI Analysis Engine")

SECURE_TOKEN = os.environ["RESTOK_AI_SECURE_TOKEN"]
BACKEND_URL = os.getenv("BACKEND_URL", "http://core-backend:8080")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ALLOW_OPENAI_EGRESS = os.getenv("ALLOW_OPENAI_EGRESS", "false").lower() == "true"
RAG_CACHE_SECONDS = int(os.getenv("RAG_CACHE_SECONDS", "300"))

class AnalysisRequest(BaseModel):
    sessionId: Optional[int] = None
    videoUrl: str
    moveType: str
    mode: str = "PRECISION"
    cameraDistance: Optional[float] = None
    cameraHeight: Optional[float] = None
    fileSize: Optional[int] = None
    fileExtension: Optional[str] = None

_rag_cache = {"expires": 0.0, "documents": []}

def load_documents():
    documents = []
    try:
        standards = requests.get(f"{BACKEND_URL}/api/standards", timeout=5)
        standards.raise_for_status()
        for item in standards.json():
            text = " | ".join(filter(None, [
                f"기술={item.get('skillName')}",
                f"코드={item.get('moveType')}",
                f"설명={item.get('description')}",
                f"부상예방={item.get('injuryPrevention')}",
                f"표준={item.get('standardData')}",
            ]))
            documents.append(Document(page_content=text, metadata={"source": "technical_standard", "id": str(item.get("id", item.get("moveType"))) }))
        knowledge = requests.get(f"{BACKEND_URL}/api/knowledge", timeout=5)
        knowledge.raise_for_status()
        for item in knowledge.json():
            text = " | ".join(filter(None, [
                f"핵심={item.get('technicalPoint')}",
                f"기준값={item.get('criteriaValue')}",
                f"코칭={item.get('coachingMessage')}",
            ]))
            documents.append(Document(page_content=text, metadata={"source": "coaching_knowledge", "id": str(item.get("id", "unknown"))}))
    except requests.RequestException as exc:
        print(f"RAG source unavailable: {exc}")
    return documents

def get_documents():
    now = time.time()
    if _rag_cache["documents"] and now < _rag_cache["expires"]:
        return _rag_cache["documents"]
    docs = load_documents()
    if not docs:
        return []
    _rag_cache.update({"documents": docs, "expires": now + RAG_CACHE_SECONDS})
    return docs

def retrieve_locally(query, limit=4):
    tokens = {token for token in query.lower().replace("=", " ").split() if len(token) > 1}
    ranked = []
    for document in get_documents():
        content = document.page_content.lower()
        score = sum(1 for token in tokens if token in content)
        if score:
            ranked.append((score, document))
    return [item[1] for item in sorted(ranked, key=lambda item: item[0], reverse=True)[:limit]]

def local_feedback(metrics):
    observations = []
    if metrics["timingSyncScore"] < 70:
        observations.append("손발 동작의 최고 속도 시점 차이가 커서 동기화 반복 연습이 필요합니다.")
    if metrics["landingStabilityScore"] < 70:
        observations.append("착지 구간의 하체 좌표 흔들림이 커서 중심 유지 연습이 필요합니다.")
    if metrics["shoulderAccel"] < 80:
        observations.append("어깨 가속도 지표가 낮아 상체 준비 동작을 점검해 주세요.")
    return " ".join(observations) or "측정 지표가 설정된 기본 범위 안에 있습니다. 반복 촬영으로 일관성을 확인해 주세요."

def grounded_feedback(move_type, metrics):
    query = f"{move_type} 어깨가속도 {metrics['shoulderAccel']} 추진력 {metrics['upperBodyMomentum']} 동기화 {metrics['timingSyncScore']} 착지 {metrics['landingStabilityScore']}"
    docs = retrieve_locally(query)
    if not docs:
        return local_feedback(metrics) + " (로컬 규칙 엔진)", []
    context = "\n".join(f"[{i + 1}] {doc.page_content}" for i, doc in enumerate(docs))
    prompt = ChatPromptTemplate.from_template("""당신은 태권도 동작 코치입니다.
아래 근거와 측정값에 명시된 내용만 사용하십시오. 근거에 없는 기술명, 수치, 의학적 판단을 만들지 마십시오.
판단할 근거가 부족하면 반드시 '근거 부족'이라고 쓰십시오.
한국어로 4문장 이내로 답하고, 각 조언 끝에 사용한 근거 번호를 [1] 형태로 표시하십시오.

근거:
{context}

측정값:
{metrics}
대상 기술: {move_type}
""")
    evidence = [{"source": doc.metadata.get("source"), "id": doc.metadata.get("id")} for doc in docs]
    if not (ALLOW_OPENAI_EGRESS and OPENAI_API_KEY):
        return local_feedback(metrics) + " (로컬 검색·규칙 엔진)", evidence
    chain = prompt | ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY) | StrOutputParser()
    try:
        feedback = chain.invoke({"context": context, "metrics": query, "move_type": move_type})
    except Exception as exc:
        print(f"Grounded generation failed: {exc}")
        feedback = local_feedback(metrics) + " (OpenAI 실패 후 로컬 규칙 엔진)"
    return feedback, evidence

def landmark_xy(landmarks, index):
    point = landmarks[index]
    return np.array([point.x, point.y], dtype=np.float64)

def analyze_pose(video_source):
    source = str(Path(video_source)) if video_source.startswith("/data/videos/") else video_source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise HTTPException(status_code=422, detail="Video source could not be opened")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    samples = []
    pose_api = mp.solutions.pose
    with pose_api.Pose(static_image_mode=False, model_complexity=1, min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while len(samples) < 1800:
            ok, frame = capture.read()
            if not ok:
                break
            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if result.pose_landmarks:
                lm = result.pose_landmarks.landmark
                samples.append({
                    "shoulder": (landmark_xy(lm, 11) + landmark_xy(lm, 12)) / 2,
                    "hip": (landmark_xy(lm, 23) + landmark_xy(lm, 24)) / 2,
                    "wrist": (landmark_xy(lm, 15) + landmark_xy(lm, 16)) / 2,
                    "ankle": (landmark_xy(lm, 27) + landmark_xy(lm, 28)) / 2,
                    "knee": (landmark_xy(lm, 25) + landmark_xy(lm, 26)) / 2,
                })
    capture.release()
    if len(samples) < max(15, int(fps / 2)):
        raise HTTPException(status_code=422, detail="Not enough pose landmarks were detected")

    def series(name): return np.stack([sample[name] for sample in samples])
    dt = 1.0 / fps
    shoulder_velocity = np.linalg.norm(np.diff(series("shoulder"), axis=0), axis=1) / dt
    shoulder_acceleration = np.abs(np.diff(shoulder_velocity)) / dt
    hip_velocity = np.linalg.norm(np.diff(series("hip"), axis=0), axis=1) / dt
    wrist_velocity = np.linalg.norm(np.diff(series("wrist"), axis=0), axis=1) / dt
    ankle_velocity = np.linalg.norm(np.diff(series("ankle"), axis=0), axis=1) / dt
    correlation = np.corrcoef(wrist_velocity, ankle_velocity)[0, 1] if np.std(wrist_velocity) > 0 and np.std(ankle_velocity) > 0 else 0
    tail = max(5, len(samples) // 5)
    landing_variance = float(np.var(series("ankle")[-tail:], axis=0).sum() + np.var(series("knee")[-tail:], axis=0).sum())

    return {
        "shoulderAccel": round(float(np.percentile(shoulder_acceleration, 90) * 100), 1),
        "upperBodyMomentum": round(float(np.percentile(hip_velocity, 90) * 90), 1),
        "timingSyncScore": int(np.clip(50 + correlation * 50, 0, 100)),
        "landingStabilityScore": int(np.clip(100 - landing_variance * 4000, 0, 100)),
        "kneeTuckTransitionMs": int(1000 * np.argmax(ankle_velocity) / fps),
        "jumpBoostHeightCm": int(np.clip((series("hip")[:, 1].max() - series("hip")[:, 1].min()) * 170, 0, 120)),
        "analyzedFrames": len(samples),
        "videoFps": round(float(fps), 2),
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze-full")
def analyze_full(request: AnalysisRequest, x_restok_ai_token: str = Header(None)):
    if x_restok_ai_token != SECURE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")
    metrics = analyze_pose(request.videoUrl)
    feedback, evidence = grounded_feedback(request.moveType, metrics)
    return {
        **metrics,
        "moveType": request.moveType,
        "aiFeedback": feedback,
        "ragEvidence": evidence,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
