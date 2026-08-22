import { useEffect, useMemo, useRef, useState } from 'react';
import './AnalysisReport.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const CONNECTIONS = [['ls','rs'],['ls','lh'],['rs','rh'],['lh','rh'],['lh','lk'],['rh','rk'],['lk','la'],['rk','ra']];

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
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

function ScoreBreakdown({ value }) {
  const breakdown = parseJson(value, {});
  const labels = { knee: '무릎', rotation: '회전', timing: '타이밍', landing: '착지', confidence: '신뢰도' };
  return (
    <div className="breakdown-list">
      {Object.entries(breakdown).map(([key, part]) => (
        <div className="breakdown-row" key={key}>
          <span>{labels[key] || key}<small>{part.weight}%</small></span>
          <div><i style={{ width: `${part.score || 0}%` }} /></div>
          <strong>{part.score}</strong>
        </div>
      ))}
    </div>
  );
}

function AnalysisReport({ data, standards, onReset }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [speed, setSpeed] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  const events = useMemo(() => parseJson(data.analysisEventsJson, []), [data.analysisEventsJson]);
  const warnings = useMemo(() => parseJson(data.qualityWarningsJson, []), [data.qualityWarningsJson]);
  const sources = useMemo(() => parseJson(data.ragSourcesJson, []), [data.ragSourcesJson]);
  const poseFrames = useMemo(() => parseJson(data.poseFramesJson, []), [data.poseFramesJson]);
  const skillName = standards.find((item) => item.moveType === data.moveType)?.skillName || data.moveType || '태권도 기술';

  useEffect(() => {
    if (!overlayEnabled || !canvasRef.current || poseFrames.length === 0) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    const nearest = poseFrames.reduce((best, frame) => Math.abs(frame.timeSec - currentTime) < Math.abs(best.timeSec - currentTime) ? frame : best, poseFrames[0]);
    const points = nearest?.points || {};
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(77, 208, 225, .95)';
    context.fillStyle = 'rgba(255,255,255,.95)';
    CONNECTIONS.forEach(([a, b]) => {
      if (!points[a] || !points[b]) return;
      context.beginPath();
      context.moveTo(points[a][0] * canvas.width, points[a][1] * canvas.height);
      context.lineTo(points[b][0] * canvas.width, points[b][1] * canvas.height);
      context.stroke();
    });
    Object.values(points).forEach((point) => {
      if (!point || point[2] < 0.35) return;
      context.beginPath();
      context.arc(point[0] * canvas.width, point[1] * canvas.height, 6, 0, Math.PI * 2);
      context.fill();
    });
  }, [currentTime, overlayEnabled, poseFrames]);

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

  const syncCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
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

  const statusText = data.analysisStatus === 'LOW_CONFIDENCE'
    ? '촬영 품질 부족 · 재촬영 권장'
    : data.analysisStatus === 'REVIEW_REQUIRED'
      ? '검토 필요'
      : '분석 완료';

  return (
    <div className="report-page">
      <header className={`report-header status-${(data.analysisStatus || 'COMPLETED').toLowerCase()}`}>
        <div>
          <p className="section-kicker">POSE ANALYSIS REPORT</p>
          <h2>{skillName}</h2>
          <p>{statusText} · 기준 {data.standardVersion || '-'} · {data.standardSourceName || '출처 미지정'}</p>
        </div>
        <div className="score-ring">
          <strong>{data.totalScore ?? '—'}</strong>
          <span>{data.totalScore == null ? '점수 보류' : '/ 100'}</span>
        </div>
      </header>

      <div className="report-grid">
        <section className="panel video-review-panel">
          <div className="panel-title-row">
            <div>
              <h3>영상 근거 확인</h3>
              <p>관절 오버레이와 느린 재생으로 부족한 시점을 직접 확인합니다.</p>
            </div>
            <button onClick={onReset}>새 분석</button>
          </div>

          <div className="video-overlay-wrap">
            {data.videoUrl ? (
              <video
                ref={videoRef}
                className="review-video"
                src={mediaUrl(data.videoUrl)}
                controls
                playsInline
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onLoadedMetadata={() => { changeSpeed(speed); syncCanvasSize(); }}
                onResize={syncCanvasSize}
              />
            ) : <div className="video-empty">저장된 영상이 없습니다.</div>}
            {data.videoUrl && <canvas ref={canvasRef} className={`pose-overlay ${overlayEnabled ? '' : 'hidden'}`} />}
          </div>

          <div className="review-controls">
            <div className="speed-controls">
              <span>재생 속도</span>
              {[0.25, 0.5, 1].map((value) => (
                <button key={value} className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)}>{value}×</button>
              ))}
            </div>
            <button className={overlayEnabled ? 'active' : ''} onClick={() => setOverlayEnabled((value) => !value)}>Pose 오버레이</button>
          </div>

          <div className="event-list">
            {events.length === 0 && <p className="empty-copy">표시할 분석 이벤트가 없습니다.</p>}
            {events.map((event, index) => (
              <button key={`${event.label}-${index}`} className={`event-card ${event.severity || ''}`} onClick={() => seekToEvent(event)}>
                <span className="event-time">{Number(event.timeSec || 0).toFixed(2)}s</span>
                <span className="event-body"><strong>{event.label}</strong><small>{event.detail}</small></span>
                <span className="event-action">느리게 보기</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel metrics-panel">
          <h3>측정 지표</h3>
          <div className="metric-grid">
            {metrics.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <h3 className="subheading">점수 근거</h3>
          <ScoreBreakdown value={data.scoreBreakdownJson} />
          <p className="metric-note">회전 속도와 점프 높이는 단일 카메라 Pose 기반 추정치이며 계측 장비의 절대값과 동일하지 않습니다.</p>
        </aside>
      </div>

      <section className="panel coaching-panel">
        <div>
          <h3>AI 코칭</h3>
          <p className="coaching-text">{data.aiFeedback || '코칭 결과가 없습니다.'}</p>
        </div>
        <div className="evidence-box">
          <h4>근거 및 기준</h4>
          <span>기준 버전: {data.standardVersion || '-'}</span>
          <span>출처: {data.standardSourceName || '-'}</span>
          <span>검증 상태: {data.standardVerified ? '지도자/전문가 검증됨' : '프로젝트 기준 · 검증 전'}</span>
          {sources.map((source) => <span key={source}>{source}</span>)}
        </div>
      </section>

      {warnings.length > 0 && <section className="panel warning-panel"><h3>촬영 품질 확인</h3>{warnings.map((warning) => <p key={warning}>• {warning}</p>)}</section>}
    </div>
  );
}

export default AnalysisReport;
