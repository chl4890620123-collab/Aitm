import os
from pathlib import Path

SECURE_TOKEN = os.getenv("AITM_AI_SECURE_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
POSE_MODEL_PATH = Path(os.getenv("POSE_MODEL_PATH", "/app/models/pose_landmarker_full.task"))
MAX_ANALYSIS_SECONDS = float(os.getenv("AITM_MAX_ANALYSIS_SECONDS", "30"))
TARGET_ANALYSIS_FPS = float(os.getenv("AITM_ANALYSIS_FPS", "15"))
