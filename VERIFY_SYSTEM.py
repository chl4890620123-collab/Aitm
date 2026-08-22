import os
import sys
from pathlib import Path

import requests


def check(name: str, url: str) -> bool:
    try:
        response = requests.get(url, timeout=5)
        ok = response.status_code < 500
        print(f"{'OK' if ok else 'FAIL':4} {name:20} {response.status_code} {url}")
        return ok
    except Exception as exc:
        print(f"FAIL {name:20} connection error: {exc}")
        return False


def integration_test() -> bool:
    sample = os.getenv("AITM_SAMPLE_VIDEO")
    if not sample:
        print("SKIP full analysis: set AITM_SAMPLE_VIDEO to run an upload -> pose -> score -> DB test.")
        return True

    path = Path(sample).expanduser().resolve()
    if not path.is_file():
        print(f"FAIL sample video not found: {path}")
        return False

    try:
        with path.open("rb") as video_file:
            response = requests.post(
                "http://localhost:8080/api/analysis/upload",
                files={"file": (path.name, video_file, "video/mp4")},
                data={
                    "userId": "diagnostics",
                    "moveType": "dolgechigi",
                    "mode": "PRECISION",
                    "sourceType": "upload",
                    "cameraDistance": "3",
                    "cameraHeight": "120",
                },
                timeout=180,
            )
    except Exception as exc:
        print(f"FAIL full analysis request: {exc}")
        return False

    print(f"{'OK' if response.ok else 'FAIL':4} Full upload analysis    {response.status_code}")
    if response.ok:
        payload = response.json()
        print(
            "     score={score}, confidence={confidence}, knee={knee}, rotation={rotation}".format(
                score=payload.get("totalScore"),
                confidence=payload.get("analysisConfidence"),
                knee=payload.get("kneeMinAngleDeg"),
                rotation=payload.get("rotationAngularVelocity"),
            )
        )
    else:
        print(response.text[:800])
    return response.ok


def main() -> int:
    print("AITM system diagnostics")
    backend = check("Spring backend", "http://localhost:8080/api/standards")
    ai = check("Pose AI", "http://localhost:8000/health")
    frontend = check("Frontend", "http://localhost:5173")
    integrated = integration_test() if backend and ai else False
    return 0 if backend and ai and frontend and integrated else 1


if __name__ == "__main__":
    sys.exit(main())
