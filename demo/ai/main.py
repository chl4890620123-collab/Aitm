import json
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from coaching import generate_feedback
from comparison import compare_measurements
from config import OPENAI_API_KEY, POSE_MODEL_PATH, SECURE_TOKEN
from pose_engine import analyze_pose, standard_from_snapshot, resolve_video_source
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

    if request.mode not in ("FAST", "PRECISION", None):
        raise HTTPException(status_code=422, detail="지원하지 않는 분석 방식입니다.")
    standard = standard_from_snapshot(request.standardData)
    video_path, temporary_path = resolve_video_source(request.videoUrl)
    try:
        # The learner's existing score is calculated unchanged by Spring.
        mode = request.mode or "PRECISION"
        metrics = analyze_pose(video_path, standard, mode=mode)
        comparison = {}
        if request.referenceAnalysisUrl:
            if not request.referenceAnalysisUrl.startswith("file://"):
                raise HTTPException(status_code=400, detail="비교 영상은 업로드한 원본 파일이어야 합니다.")
            reference_path, reference_temp = resolve_video_source(request.referenceAnalysisUrl)
            try:
                reference_metrics = analyze_pose(reference_path, standard, mode=mode)
                comparison = {
                    "referenceMeasurementsJson": json.dumps(
                        compare_measurements(metrics, reference_metrics), ensure_ascii=False
                    ),
                    "referencePoseFramesJson": reference_metrics["poseFramesJson"],
                    "referenceAnalysisEventsJson": reference_metrics["analysisEventsJson"],
                }
            finally:
                if reference_temp:
                    Path(reference_temp).unlink(missing_ok=True)
        feedback, sources = generate_feedback(move_type, metrics, standard)
        return {
            "moveType": move_type,
            "aiFeedback": feedback,
            "ragSourcesJson": json.dumps(sources, ensure_ascii=False),
            **metrics,
            **comparison,
        }
    finally:
        if temporary_path:
            Path(temporary_path).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
