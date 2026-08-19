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
    <header className="report-main-header"><div><p>Kinematics Analysis Report</p><h1>{skillName}</h1></div><button onClick={onReset}>New Session</button></header>
    <section className="score-summary"><h2>Total Score: {Math.round(data.totalScore || 0)}</h2></section>
    {data.playbackUrl && <section><h3>Slow Motion Review</h3><video ref={videoRef} src={data.playbackUrl.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL || ''}${data.playbackUrl}` : data.playbackUrl} controls width="100%" onLoadedMetadata={() => changeRate(rate)} /><div><button onClick={() => frame(-1)}>◀ 1 frame</button>{[0.25, 0.5, 1].map((value) => <button key={value} onClick={() => changeRate(value)}>{value}×</button>)}<button onClick={() => frame(1)}>1 frame ▶</button></div></section>}
    <section className="ai-feedback-section"><h3>Grounded AI Coaching</h3><p>{data.aiFeedback}</p>{data.ragEvidence?.length > 0 && <small>근거: {data.ragEvidence.map((item) => `${item.source}:${item.id}`).join(', ')}</small>}</section>
    <section className="physics-data-section"><h3>Measured Metrics</h3><div className="metrics-table">
      <Metric label="어깨 가속도" value={data.shoulderAccel} unit="normalized" />
      <Metric label="상체 추진력" value={data.upperBodyMomentum} unit="normalized" />
      <Metric label="동작 동기화" value={data.timingSyncScore} unit="/ 100" />
      <Metric label="착지 안정성" value={data.landingStabilityScore} unit="/ 100" />
      <Metric label="무릎 전환" value={data.kneeTuckTransitionMs} unit="ms" />
      <Metric label="분석 프레임" value={data.analyzedFrames} unit="frames" />
    </div></section>
  </div>;
};

const Metric = ({ label, value, unit }) => <div className="metric-item"><span>{label}</span><strong>{value == null ? 'N/A' : Math.round(value)} {unit}</strong></div>;
export default AnalysisReport;
