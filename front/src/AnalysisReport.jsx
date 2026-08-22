import { useMemo, useRef, useState } from 'react';
import './AnalysisReport.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function parseArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mediaUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:')) return value;
  return `${API_BASE_URL}${value}`;
}

function formatValue(value, suffix = '', digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function AnalysisReport({ data, standards, onReset }) {
  const videoRef = useRef(null);
  const [speed, setSpeed] = useState(0.5);

  const events = useMemo(() => parseArray(data.analysisEventsJson), [data.analysisEventsJson]);
  const warnings = useMemo(() => parseArray(data.qualityWarningsJson), [data.qualityWarningsJson]);
  const sources = useMemo(() => parseArray(data.ragSourcesJson), [data.ragSourcesJson]);
  const skillName = standards.find((item) => item.moveType === data.moveType)?.skillName || data.moveType || '태권도 기술';

  const changeSpeed = (nextSpeed) => {
    setSpeed(nextSpeed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
  };

  const seekToEvent = (event) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Number(event.timeSec) - 0.4);
    video.playbackRate = 0.5;
    setSpeed(0.5);
    video.play().catch(() => {});
  };

  const metrics = [
    ['무릎 최소 각도', formatValue(data.kneeMinAngleDeg, '°', 1)],
    ['추정 회전 각속도', formatValue(data.rotationAngularVelocity, ' deg/s', 0)],
    ['골반 회전 범위', formatValue(data.hipRotationRangeDeg, '°', 0)],
    ['어깨-골반 분리', formatValue(data.shoulderHipSeparationDeg, '°', 0)],
    ['상대 점프 높이', formatValue(data.jumpHeightRelative, '%', 1)],
    ['착지 안정성', formatValue(data.landingStabilityScore, '/100', 0)],
    ['타이밍', formatValue(data.timingSyncScore, '/100', 0)],
    ['분석 신뢰도', formatValue(data.analysisConfidence, '%', 0)],
  ];

  return (
    <div className="report-page">
      <header className="report-header">
        <div>
          <p className="section-kicker">POSE ANALYSIS REPORT</p>
          <h2>{skillName}</h2>
          <p>총점은 실제 Pose 측정값을 Spring 규칙 엔진에서 계산한 결과입니다.</p>
        </div>
        <div className="score-ring">
          <strong>{Math.round(data.totalScore || 0)}</strong>
          <span>/ 100</span>
        </div>
      </header>

      <div className="report-grid">
        <section className="panel video-review-panel">
          <div className="panel-title-row">
            <div>
              <h3>느린 재생으로 문제 구간 확인</h3>
              <p>아래 이벤트를 누르면 해당 구간으로 이동해 0.5배속으로 재생합니다.</p>
            </div>
            <button onClick={onReset}>새 분석</button>
          </div>

          {data.videoUrl ? (
            <video ref={videoRef} className="review-video" src={mediaUrl(data.videoUrl)} controls playsInline onLoadedMetadata={() => changeSpeed(speed)} />
          ) : (
            <div className="video-empty">저장된 영상이 없습니다.</div>
          )}

          <div className="speed-controls">
            <span>재생 속도</span>
            {[0.25, 0.5, 1].map((value) => (
              <button key={value} className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)}>{value}×</button>
            ))}
          </div>

          <div className="event-list">
            {events.length === 0 && <p className="empty-copy">표시할 분석 이벤트가 없습니다.</p>}
            {events.map((event, index) => (
              <button key={`${event.label}-${index}`} className={`event-card ${event.severity || ''}`} onClick={() => seekToEvent(event)}>
                <span className="event-time">{Number(event.timeSec || 0).toFixed(2)}s</span>
                <span className="event-body">
                  <strong>{event.label}</strong>
                  <small>{event.detail}</small>
                </span>
                <span className="event-action">느리게 보기</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel metrics-panel">
          <h3>측정 지표</h3>
          <div className="metric-grid">
            {metrics.map(([label, value]) => (
              <div className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="metric-note">회전 속도와 점프 높이는 단일 카메라 Pose 기반 추정치이며 계측 장비의 절대값과 동일하지 않습니다.</p>
        </aside>
      </div>

      <section className="panel coaching-panel">
        <div>
          <h3>AI 코칭</h3>
          <p className="coaching-text">{data.aiFeedback || '코칭 결과가 없습니다.'}</p>
        </div>
        <div className="evidence-box">
          <h4>코칭 근거</h4>
          {sources.length > 0 ? sources.map((source) => <span key={source}>{source}</span>) : <span>프로젝트 측정 규칙</span>}
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="panel warning-panel">
          <h3>촬영 품질 확인</h3>
          {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
        </section>
      )}
    </div>
  );
}

export default AnalysisReport;
