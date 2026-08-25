import json
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from coaching import generate_feedback
from config import OPENAI_API_KEY, POSE_MODEL_PATH, SECURE_TOKEN
from pose_engine import analyze_pose, load_project_standard, resolve_video_source
from schemas import AnalysisRequest

app = FastAPI(title="AITM Pose Analysis Engine", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "poseModelReady": POSE_MODEL_PATH.is_file(),
        "llmConfigured": bool(OPENAI_API_KEY),
    }


@app.post("/analyze-full")
def analyze_full(
    request: AnalysisRequest,
    x_aitm_ai_token: Optional[str] = Header(default=None, alias="X-AITM-AI-TOKEN"),
) -> Dict[str, Any]:
    if not SECURE_TOKEN:
        raise HTTPException(status_code=503, detail="AITM_AI_SECURE_TOKEN이 설정되지 않았습니다.")
    if x_aitm_ai_token != SECURE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid AITM AI service token")

    move_type = request.moveType or "dolgechigi"
    standard = load_project_standard(move_type)
    video_path, temporary_path = resolve_video_source(request.videoUrl)
    try:
        metrics = analyze_pose(video_path, standard)
        feedback, sources = generate_feedback(move_type, metrics, standard)
        return {
            "moveType": move_type,
            "aiFeedback": feedback,
            "ragSourcesJson": json.dumps(sources, ensure_ascii=False),
            **metrics,
        }
    finally:
        if temporary_path:
            Path(temporary_path).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
