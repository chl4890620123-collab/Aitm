"""Describe measured differences between two user-supplied clips, not a skill grade.

Preserves the established AITM scoring and event rules for the learner's clip.
Only compares measurements from the same Pose engine and scoring snapshot.
"""
import math

COMPARABLE = {
    "kneeMinAngleDeg": ("무릎 최소 각도", "°"),
    "rotationAngularVelocity": ("추정 회전 각속도", "deg/s"),
    "hipRotationRangeDeg": ("골반 회전 범위", "°"),
    "landingStabilityScore": ("착지 안정성", "/100"),
    "timingSyncScore": ("동작 타이밍", "/100"),
}


def compare_measurements(learner: dict, reference: dict) -> dict:
    differences = []
    for key, (label, unit) in COMPARABLE.items():
        left, right = learner.get(key), reference.get(key)
        try:
            mine = float(left)
            model = float(right)
        except (ValueError, TypeError):
            continue
        if not (math.isfinite(mine) and math.isfinite(model)):
            continue
        differences.append({
            "metric": key,
            "label": label,
            "unit": unit,
            "mine": round(mine, 2),
            "reference": round(model, 2),
            "delta": round(mine - model, 2),
        })
    return {
        "differences": differences,
        "learnerConfidence": learner.get("analysisConfidence"),
        "referenceConfidence": reference.get("analysisConfidence"),
        "note": ("두 영상의 원본 Pose 측정값 차이입니다. 시점·촬영 각도·"
                 "신체 조건에 따라 달라지며, 차이가 크다고 기술이 잘못됐다는 뜻은 아닙니다."),
    }
