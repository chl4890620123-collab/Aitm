from typing import Any, Dict, List, Tuple

import requests
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from config import BACKEND_URL, OPENAI_API_KEY


def _documents() -> List[Document]:
    docs: List[Document] = []
    try:
        response = requests.get(f"{BACKEND_URL}/api/standards", timeout=3)
        if response.ok:
            for item in response.json():
                source = f"기술 표준: {item.get('skillName', item.get('moveType', 'unknown'))}"
                docs.append(Document(
                    page_content=(
                        f"{source}\n설명: {item.get('description') or ''}\n"
                        f"부상 예방: {item.get('injuryPrevention') or ''}\n"
                        f"프로젝트 기준값: {item.get('standardData') or ''}"
                    ),
                    metadata={"source": source},
                ))
    except Exception as exc:
        print(f"[AITM] standard RAG load failed: {exc}")

    try:
        response = requests.get(f"{BACKEND_URL}/api/knowledge", timeout=3)
        if response.ok:
            for item in response.json():
                source = f"코칭 지식: {item.get('technicalPoint', 'unknown')}"
                docs.append(Document(
                    page_content=f"{source}\n기준값: {item.get('criteriaValue')}\n코칭: {item.get('coachingMessage') or ''}",
                    metadata={"source": source},
                ))
    except Exception as exc:
        print(f"[AITM] knowledge RAG load failed: {exc}")
    return docs


def _fallback(metrics: Dict[str, Any], standard: Dict[str, float]) -> str:
    feedback = []
    if abs(float(metrics["kneeMinAngleDeg"]) - standard["idealKneeMinDeg"]) > standard["kneeToleranceDeg"]:
        feedback.append("무릎 수축 구간을 우선 교정하세요. 최소 각도가 프로젝트 기준 범위를 벗어났습니다.")
    if float(metrics["rotationAngularVelocity"]) < standard["minRotationVelocityDegSec"]:
        feedback.append("골반 회전 피크가 낮습니다. 회전 시작 구간을 0.5배속으로 확인하세요.")
    if int(metrics["landingStabilityScore"]) < int(standard["minLandingStabilityScore"]):
        feedback.append("착지 직후 중심 흔들림이 큽니다. 발-무릎 방향과 상체 균형을 확인하세요.")
    if int(metrics["timingSyncScore"]) < 75:
        feedback.append("무릎 수축과 회전 피크의 타이밍 차이가 큽니다. 이벤트 타임라인을 비교하세요.")
    if int(metrics["analysisConfidence"]) < 70:
        feedback.append("촬영 품질이 낮습니다. 전신이 보이도록 다시 촬영하는 것이 좋습니다.")
    return " ".join(feedback) or "주요 측정 지표가 프로젝트 기준 범위에 들어옵니다. 같은 조건으로 반복 촬영해 일관성을 확인하세요."


def generate_feedback(move_type: str, metrics: Dict[str, Any], standard: Dict[str, float]) -> Tuple[str, List[str]]:
    fallback = _fallback(metrics, standard)
    if not OPENAI_API_KEY:
        return fallback + " (LLM 미설정: 측정 규칙 기반 피드백)", ["프로젝트 측정 규칙"]

    docs = _documents()
    if not docs:
        return fallback, ["프로젝트 측정 규칙"]

    query = (
        f"{move_type} 실제 Pose 측정: 무릎 최소각 {metrics['kneeMinAngleDeg']}도, "
        f"추정 회전각속도 {metrics['rotationAngularVelocity']}deg/s, "
        f"착지 안정성 {metrics['landingStabilityScore']}, "
        f"타이밍 {metrics['timingSyncScore']}, 분석 신뢰도 {metrics['analysisConfidence']}."
    )
    try:
        store = FAISS.from_documents(docs, OpenAIEmbeddings(api_key=OPENAI_API_KEY))
        matched = store.as_retriever(search_kwargs={"k": min(4, len(docs))}).invoke(query)
        context = "\n\n".join(document.page_content for document in matched)
        sources = list(dict.fromkeys(document.metadata.get("source", "등록 지식") for document in matched))
        prompt = (
            "당신은 태권도 코칭 보조 시스템입니다. 측정값을 새로 만들지 말고 제공된 실제 Pose 측정값과 검색 지식만 사용하세요. "
            "지도자를 대체한다고 표현하지 말고, 가장 중요한 개선점 2~3개를 짧고 구체적으로 한국어로 설명하세요.\n\n"
            f"[측정]\n{query}\n\n[검색 지식]\n{context}\n\n[규칙 판단]\n{fallback}"
        )
        result = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=OPENAI_API_KEY).invoke(prompt)
        text = str(result.content).strip()
        return text or fallback, sources or ["프로젝트 측정 규칙"]
    except Exception as exc:
        print(f"[AITM] RAG feedback failed: {exc}")
        return fallback, ["프로젝트 측정 규칙"]
