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
    token = os.getenv("RESTOK_AI_SECURE_TOKEN")
    if not sample or not token:
        print("SKIP integration test: set AITM_SAMPLE_VIDEO and RESTOK_AI_SECURE_TOKEN to run it.")
        return True

    path = Path(sample).expanduser().resolve()
    if not path.is_file():
        print(f"FAIL sample video not found: {path}")
        return False

    payload = {
        "videoUrl": path.as_uri(),
        "sourceType": "upload",
        "moveType": "dolgechigi",
        "mode": "PRECISION",
        "fileExtension": path.suffix.lstrip(".").lower(),
    }
    response = requests.post(
        "http://localhost:8000/analyze-full",
        json=payload,
        headers={"X-RESTOK-AI-TOKEN": token},
        timeout=120,
    )
    print(f"{'OK' if response.ok else 'FAIL':4} AI sample analysis     {response.status_code}")
    if not response.ok:
        print(response.text[:500])
    return response.ok


def main() -> int:
    print("AITM system diagnostics")
    backend = check("Spring backend", "http://localhost:8080/api/standards")
    ai = check("Pose AI", "http://localhost:8000/health")
    frontend = check("Frontend", "http://localhost:5173")
    integrated = integration_test() if ai else False
    return 0 if backend and ai and frontend and integrated else 1


if __name__ == "__main__":
    sys.exit(main())
