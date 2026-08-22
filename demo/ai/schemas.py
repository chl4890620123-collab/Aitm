from typing import Optional
from pydantic import BaseModel


class AnalysisRequest(BaseModel):
    sessionId: Optional[int] = None
    userId: Optional[str] = None
    videoUrl: str
    playbackUrl: Optional[str] = None
    sourceType: Optional[str] = "upload"
    moveType: Optional[str] = "dolgechigi"
    mode: Optional[str] = "PRECISION"
    cameraDistance: Optional[float] = None
    cameraHeight: Optional[float] = None
    fileSize: Optional[int] = None
    fileExtension: Optional[str] = None
