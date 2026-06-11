import requests
import time
import os

def check_service(name, url):
    try:
        response = requests.get(url, timeout=3)
        if response.status_code < 500:
            print(f"✅ {name:.<25} [정상] (Status: {response.status_code})")
            return True
        else:
            print(f"❌ {name:.<25} [오류] (Status: {response.status_code})")
    except Exception as e:
        print(f"❌ {name:.<25} [중단] (연결 실패)")
    return False

def run_diagnostics():
    print("\n" + "="*50)
    print("🥋 AITM 시스템 통합 진단 도구 (Diagnostics)")
    print("="*50 + "\n")

    # 1. 개별 서비스 체크
    backend_up = check_service("1. 메인 서버 (Spring)", "http://localhost:8080/api/standards")
    ai_up = check_service("2. AI 엔진 (FastAPI)", "http://localhost:8000")
    
    # 3. 통합 통신 테스트 (Backend -> AI Engine)
    if backend_up and ai_up:
        print("\n" + "-"*50)
        print("🔗 서비스 간 통신 검증 (Integration Test)")
        print("-"*50)
        
        # 보안 토큰 테스트
        secure_token = "restok-secret-2024" # 기본값
        headers = {"X-Restok-Ai-Token": secure_token}
        payload = {"videoUrl": "test.mp4", "moveType": "dolgechigi"}
        
        try:
            res = requests.post("http://localhost:8000/analyze-full", json=payload, headers=headers, timeout=5)
            if res.status_code == 200:
                print("✅ 서버 간 보안 통신....... [성공] (RAG 엔진 가동 확인)")
            else:
                print(f"⚠️ 서버 간 보안 통신....... [실패] (Status: {res.status_code})")
        except:
            print("⚠️ 서버 간 보안 통신....... [실패] (연결 타임아웃)")

    print("\n" + "="*50)
    print("진단 완료. 모든 서비스가 녹색(✅)일 때 정상 작동합니다.")
    print("="*50 + "\n")

if __name__ == "__main__":
    run_diagnostics()
