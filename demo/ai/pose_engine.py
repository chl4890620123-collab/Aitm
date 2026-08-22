import json
import math
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
import requests
from fastapi import HTTPException

from config import BACKEND_URL, MAX_ANALYSIS_SECONDS, POSE_MODEL_PATH, TARGET_ANALYSIS_FPS

LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_HIP, RIGHT_HIP = 23, 24
LEFT_KNEE, RIGHT_KNEE = 25, 26
LEFT_ANKLE, RIGHT_ANKLE = 27, 28

DEFAULT_STANDARD = {
    "idealKneeMinDeg": 90.0,
    "kneeToleranceDeg": 20.0,
    "minRotationVelocityDegSec": 280.0,
    "minLandingStabilityScore": 75.0,
    "idealKneeToRotationMs": 180.0,
    "timingToleranceMs": 180.0,
}


def load_project_standard(move_type: str) -> Dict[str, float]:
    standard = dict(DEFAULT_STANDARD)
    try:
        response = requests.get(f"{BACKEND_URL}/api/standards/{move_type}", timeout=3)
        if response.ok and response.json().get("standardData"):
            raw = json.loads(response.json()["standardData"])
            for key, fallback in standard.items():
                if key in raw:
                    standard[key] = float(raw[key])
    except Exception as exc:
        print(f"[AITM] standard lookup failed: {exc}")
    return standard


def resolve_video_source(video_url: str) -> Tuple[str, Optional[str]]:
    if video_url.startswith("file://"):
        path = Path(video_url[7:]).resolve()
        if not path.is_file():
            raise HTTPException(status_code=404, detail="저장된 영상 파일을 찾을 수 없습니다.")
        return str(path), None

    if video_url.startswith(("http://", "https://")):
        suffix = Path(video_url.split("?", 1)[0]).suffix or ".mp4"
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_path = temp.name
        temp.close()
        try:
            with requests.get(video_url, stream=True, timeout=20) as response:
                response.raise_for_status()
                with open(temp_path, "wb") as output:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            output.write(chunk)
        except Exception as exc:
            Path(temp_path).unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"원격 영상을 읽을 수 없습니다: {exc}") from exc
        return temp_path, temp_path

    raise HTTPException(status_code=400, detail="지원하지 않는 영상 경로입니다.")


def _point(landmarks: List[Any], index: int) -> np.ndarray:
    lm = landmarks[index]
    return np.array([float(lm.x), float(lm.y), float(lm.z or 0.0)], dtype=np.float64)


def _mid(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return (a + b) / 2.0


def _angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba, bc = a - b, c - b
    denominator = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denominator <= 1e-9:
        return 180.0
    cosine = float(np.clip(np.dot(ba, bc) / denominator, -1.0, 1.0))
    return math.degrees(math.acos(cosine))


def _yaw(left: np.ndarray, right: np.ndarray) -> float:
    vector = right - left
    return math.atan2(float(vector[2]), float(vector[0]))


def _visibility(landmarks: List[Any]) -> float:
    values = []
    for index in (LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE):
        value = getattr(landmarks[index], "visibility", None)
        if value is not None:
            values.append(float(value))
    return float(np.mean(values)) if values else 0.8


def _abs_percentile(values: np.ndarray, percentile: float) -> float:
    finite = np.abs(values[np.isfinite(values)])
    return float(np.percentile(finite, percentile)) if finite.size else 0.0


def _event(time_sec: float, label: str, detail: str, severity: str, metric: str, value: float) -> Dict[str, Any]:
    return {
        "timeSec": round(max(0.0, float(time_sec)), 2),
        "label": label,
        "detail": detail,
        "severity": severity,
        "metric": metric,
        "value": round(float(value), 1),
    }


def _landing_index(times: np.ndarray, hip_y: np.ndarray, apex: int, body_height: float) -> int:
    baseline = float(np.median(hip_y[:max(2, len(hip_y) // 5)]))
    tolerance = max(0.01, body_height * 0.08)
    for index in range(apex + 1, len(times)):
        if abs(float(hip_y[index]) - baseline) <= tolerance:
            return index
    return len(times) - 1


def analyze_pose(video_path: str, standard: Dict[str, float]) -> Dict[str, Any]:
    if not POSE_MODEL_PATH.is_file():
        raise HTTPException(status_code=503, detail="MediaPipe Pose 모델 파일이 없습니다.")

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise HTTPException(status_code=400, detail="영상을 디코딩할 수 없습니다.")

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
    if fps <= 1 or not math.isfinite(fps):
        fps = 30.0
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or fps * MAX_ANALYSIS_SECONDS)
    limit = min(total, int(fps * MAX_ANALYSIS_SECONDS))
    stride = max(1, int(round(fps / max(1.0, TARGET_ANALYSIS_FPS))))

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(POSE_MODEL_PATH)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    records: List[Dict[str, float]] = []
    sampled = detected = 0
    min_margin = 1.0
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            frame_index = 0
            while frame_index < limit:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % stride:
                    frame_index += 1
                    continue

                sampled += 1
                timestamp_ms = int(round(frame_index / fps * 1000))
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
                result = detector.detect_for_video(image, timestamp_ms)
                frame_index += 1
                if not result.pose_landmarks:
                    continue

                detected += 1
                normalized = result.pose_landmarks[0]
                world = result.pose_world_landmarks[0] if result.pose_world_landmarks else normalized

                ls, rs = _point(normalized, LEFT_SHOULDER), _point(normalized, RIGHT_SHOULDER)
                lh, rh = _point(normalized, LEFT_HIP), _point(normalized, RIGHT_HIP)
                lk, rk = _point(normalized, LEFT_KNEE), _point(normalized, RIGHT_KNEE)
                la, ra = _point(normalized, LEFT_ANKLE), _point(normalized, RIGHT_ANKLE)
                lhw, rhw = _point(world, LEFT_HIP), _point(world, RIGHT_HIP)
                lsw, rsw = _point(world, LEFT_SHOULDER), _point(world, RIGHT_SHOULDER)

                hip = _mid(lh, rh)
                shoulder = _mid(ls, rs)
                ankle = _mid(la, ra)
                line = rs - ls
                points = np.array([ls[:2], rs[:2], lh[:2], rh[:2], lk[:2], rk[:2], la[:2], ra[:2]])
                min_margin = min(min_margin, float(min(np.min(points), np.min(1.0 - points))))

                records.append({
                    "time": timestamp_ms / 1000.0,
                    "knee": min(_angle(lh, lk, la), _angle(rh, rk, ra)),
                    "hipYaw": _yaw(lhw, rhw),
                    "shoulderYaw": _yaw(lsw, rsw),
                    "hipX": float(hip[0]),
                    "hipY": float(hip[1]),
                    "bodyHeight": max(0.05, float(np.linalg.norm(shoulder[:2] - ankle[:2]))),
                    "shoulderTilt": math.degrees(math.atan2(float(line[1]), float(line[0]))),
                    "visibility": _visibility(normalized),
                })
    finally:
        capture.release()

    if sampled < 5 or len(records) < 5:
        raise HTTPException(status_code=422, detail="전신 Pose를 충분히 검출하지 못했습니다. 전신이 보이도록 다시 촬영하세요.")

    times = np.array([row["time"] for row in records])
    knee = np.array([row["knee"] for row in records])
    hip_yaw = np.unwrap(np.array([row["hipYaw"] for row in records]))
    shoulder_yaw = np.unwrap(np.array([row["shoulderYaw"] for row in records]))
    hip_x = np.array([row["hipX"] for row in records])
    hip_y = np.array([row["hipY"] for row in records])
    body_height = float(np.median([row["bodyHeight"] for row in records]))
    tilt = np.array([row["shoulderTilt"] for row in records])
    visibility = np.array([row["visibility"] for row in records])

    hip_velocity = np.gradient(hip_yaw, times, edge_order=1)
    shoulder_velocity = np.gradient(shoulder_yaw, times, edge_order=1)
    shoulder_accel = np.gradient(shoulder_velocity, times, edge_order=1)

    rotation_velocity = _abs_percentile(np.degrees(hip_velocity), 95)
    rotation_range = math.degrees(float(np.max(hip_yaw) - np.min(hip_yaw)))
    knee_value = float(np.min(knee))
    knee_index = int(np.argmin(knee))
    rotation_index = int(np.argmax(np.abs(hip_velocity)))

    baseline_y = float(np.median(hip_y[:max(2, len(hip_y) // 5)]))
    apex = int(np.argmin(hip_y))
    jump_relative = max(0.0, (baseline_y - float(hip_y[apex])) / body_height * 100.0)
    landing = _landing_index(times, hip_y, apex, body_height)

    tail_start = min(landing, max(0, len(records) - max(4, len(records) // 5)))
    landing_score = int(round(np.clip(
        100.0 - float(np.std(hip_x[tail_start:])) * 1200.0 - float(np.std(tilt[tail_start:])) * 1.2,
        0.0,
        100.0,
    )))

    gap_ms = abs(float(times[rotation_index] - times[knee_index])) * 1000.0
    timing_score = int(round(np.clip(
        100.0 - abs(gap_ms - standard["idealKneeToRotationMs"]) / max(50.0, standard["timingToleranceMs"]) * 40.0,
        0.0,
        100.0,
    )))

    detection_rate = detected / max(1, sampled)
    average_visibility = float(np.clip(np.mean(visibility), 0.0, 1.0))
    confidence = int(round(np.clip((detection_rate * 0.65 + average_visibility * 0.35) * 100.0, 0.0, 100.0)))

    warnings: List[str] = []
    if detection_rate < 0.8:
        warnings.append("일부 프레임에서 전신 Pose 검출이 끊겼습니다.")
    if average_visibility < 0.7:
        warnings.append("관절 가림 또는 조명 영향으로 관절 신뢰도가 낮습니다.")
    if min_margin < 0.02:
        warnings.append("몸 일부가 화면 가장자리에 가까워졌습니다. 카메라를 조금 더 멀리 두세요.")

    events = []
    knee_ok = abs(knee_value - standard["idealKneeMinDeg"]) <= standard["kneeToleranceDeg"]
    events.append(_event(
        times[knee_index],
        "무릎 수축",
        f"최소 무릎 각도 {knee_value:.1f}°. 프로젝트 기준 {standard['idealKneeMinDeg']:.0f}° ± {standard['kneeToleranceDeg']:.0f}°.",
        "good" if knee_ok else "warning",
        "kneeMinAngleDeg",
        knee_value,
    ))

    rotation_ok = rotation_velocity >= standard["minRotationVelocityDegSec"]
    events.append(_event(
        times[rotation_index],
        "회전 피크",
        f"추정 회전 각속도 {rotation_velocity:.0f} deg/s. 프로젝트 기준 {standard['minRotationVelocityDegSec']:.0f} deg/s.",
        "good" if rotation_ok else "warning",
        "rotationAngularVelocity",
        rotation_velocity,
    ))

    landing_ok = landing_score >= standard["minLandingStabilityScore"]
    events.append(_event(
        times[landing],
        "착지",
        f"착지 안정성 {landing_score}/100. 착지 직후 골반과 상체 흔들림을 평가했습니다.",
        "good" if landing_ok else "warning",
        "landingStabilityScore",
        landing_score,
    ))

    if timing_score < 75:
        events.append(_event(
            times[rotation_index],
            "동작 타이밍",
            f"무릎 수축과 회전 피크 간격이 {gap_ms:.0f}ms입니다. 이벤트 두 지점을 느린 재생으로 비교하세요.",
            "warning",
            "timingSyncScore",
            timing_score,
        ))

    return {
        "preLoadingFlexDeg": round(float(np.median(knee[:max(2, len(knee) // 5)])), 1),
        "jumpBoostHeightCm": None,
        "eyeLeadingTimeMs": None,
        "diagonalPathAngle": None,
        "rotationAngularVelocity": round(rotation_velocity, 1),
        "totalRotationDeg": round(rotation_range, 1),
        "upperBodyMomentum": None,
        "shoulderAccel": round(_abs_percentile(np.degrees(shoulder_accel), 90), 1),
        "kneeTuckTransitionMs": int(round(max(0.0, times[knee_index] - times[0]) * 1000.0)),
        "handCompactnessScore": None,
        "landingStabilityScore": landing_score,
        "timingSyncScore": timing_score,
        "nextMotionTransitionMs": None,
        "kneeMinAngleDeg": round(knee_value, 1),
        "hipRotationRangeDeg": round(rotation_range, 1),
        "shoulderHipSeparationDeg": round(float(np.max(np.abs(np.degrees(shoulder_yaw - hip_yaw)))), 1),
        "jumpHeightRelative": round(jump_relative, 1),
        "poseDetectionRate": round(detection_rate, 3),
        "analysisConfidence": confidence,
        "analysisEventsJson": json.dumps(sorted(events, key=lambda row: row["timeSec"]), ensure_ascii=False),
        "qualityWarningsJson": json.dumps(warnings, ensure_ascii=False),
    }
