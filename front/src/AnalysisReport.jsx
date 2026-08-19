import React, { useRef, useState } from 'react';
import './AnalysisReport.css';

const AnalysisReport = ({ data, standards, onReset }) => {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(0.5);
  if (!data) return null;
  const skillName = standards.find((s) => s.moveType === data.moveType)?.skillName || data.moveType;
  const changeRate = (next) => { setRate(next); if (videoRef.current) videoRef.current.playbackRate = next; };
  const frame = (direction) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + direction / (data.videoFps || 30)); };
  return <div className="detailed-report-view">
    <header className="report-main-header"><div><span className="section-kicker">분석이 완료됐어요</span><h1>{skillName}</h1><p>측정 결과와 AI 코칭을 천천히 확인해 보세요.</p></div><button className="new-session-btn" onClick={onReset}>새 동작 분석</button></header>
    <section className="score-summary"><span>종합 동작 점수</span><h2>{Math.round(data.totalScore || 0)}<small> / 100</small></h2><p>가속도·추진력·동기화·착지 안정성을 종합한 점수예요.</p></section>
    {data.playbackUrl && <section className="review-section"><div className="section-title"><h3>슬로 모션으로 다시 보기</h3><p>배속과 프레임 버튼으로 자세를 세밀하게 확인하세요.</p></div><video ref={videoRef} src={data.playbackUrl.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL || ''}${data.playbackUrl}` : data.playbackUrl} controls width="100%" onLoadedMetadata={() => changeRate(rate)} /><div className="review-controls"><button onClick={() => frame(-1)}>◀ 이전 프레임</button>{[0.25, 0.5, 1].map((value) => <button className={rate === value ? 'active' : ''} key={value} onClick={() => changeRate(value)}>{value}×</button>)}<button onClick={() => frame(1)}>다음 프레임 ▶</button></div></section>}
    <div className="report-grid"><section className="ai-feedback-section"><div className="section-title"><h3>AI 코치의 한마디</h3><p>등록된 기술 기준에 근거한 개선 안내예요.</p></div><div className="coach-message"><span>AI</span><p>{data.aiFeedback}</p></div>{data.ragEvidence?.length > 0 && <small className="evidence">사용 근거: {data.ragEvidence.map((item) => `${item.source}:${item.id}`).join(', ')}</small>}</section>
    <section className="physics-data-section"><div className="section-title"><h3>자세히 측정한 항목</h3><p>값이 높을수록 기준 동작에 가까워요.</p></div><div className="metrics-table">
      <Metric label="어깨 가속도" value={data.shoulderAccel} unit="normalized" />
      <Metric label="상체 추진력" value={data.upperBodyMomentum} unit="normalized" />
      <Metric label="동작 동기화" value={data.timingSyncScore} unit="/ 100" />
      <Metric label="착지 안정성" value={data.landingStabilityScore} unit="/ 100" />
      <Metric label="무릎 전환" value={data.kneeTuckTransitionMs} unit="ms" />
      <Metric label="분석 프레임" value={data.analyzedFrames} unit="frames" />
    </div></section></div>
  </div>;
};

const Metric = ({ label, value, unit }) => <div className="metric-item"><span>{label}</span><strong>{value == null ? 'N/A' : Math.round(value)} {unit}</strong></div>;
export default AnalysisReport;
