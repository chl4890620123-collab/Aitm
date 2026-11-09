import { useEffect, useMemo, useRef, useState } from 'react';
import AnalysisMetricsGraph from './AnalysisMetricsGraph';
import { getYouTubeEmbed } from './youtube';
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
  const [duration, setDuration] = useState(0);
  const [displayRate, setDisplayRate] = useState(1);
  const [showReference, setShowReference] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const scrubAnchorRef = useRef(null);

  const events = useMemo(() => parseJson(data.analysisEventsJson, []), [data.analysisEventsJson]);
  const warnings = useMemo(() => parseJson(data.qualityWarningsJson, []), [data.qualityWarningsJson]);
  const sources = useMemo(() => parseJson(data.ragSourcesJson, []), [data.ragSourcesJson]);
  const poseFrames = useMemo(() => parseJson(data.poseFramesJson, []), [data.poseFramesJson]);
  const goodEvents = events.filter(event => event.severity === 'good');
  const focusEvents = events.filter(event => event.severity === 'warning');
  const skill = standards.find(item => item.moveType === data.moveType);
  const skillName = skill?.skillName || data.moveType || '태권도 기술';
  const referenceUrl = data.referenceVideoUrl || skill?.referenceVideoUrl;
  const referenceEmbed = getYouTubeEmbed(referenceUrl);

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

  // Gradually slow the ORIGINAL video near an actual measured event; no
  // slideshow frames, fake pauses, or transcoding. Normal speed resumes after.
  const slowRateAt = (time, eventTime) => {
    if (!Number.isFinite(eventTime)) return 1;
    const distance = Math.abs(time - eventTime);
    const normalized = Math.min(1, distance / 1.35);
    const eased = normalized * normalized * (3 - 2 * normalized);
    return 0.3 + 0.7 * eased;
  };

  const playEvidence = (event) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(Number(event.timeSec))) return;
    setSelectedEvent(event);
    scrubAnchorRef.current = null;
    video.currentTime = Math.max(0, Number(event.timeSec) - 1.6);
    video.playbackRate = 1;
    video.play().catch(() => {});
  };

  const scrubTo = (time) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const nextTime = Math.min(Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER,
      Math.max(0, Number(time)));
    if (!Number.isFinite(nextTime)) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    scrubAnchorRef.current = nextTime;
    const closest = events.reduce((best, event) => (
      Number.isFinite(Number(event.timeSec)) &&
      Math.abs(Number(event.timeSec) - nextTime) < Math.abs(Number(best?.timeSec ?? Infinity) - nextTime)
        ? event : best
    ), null);
    setSelectedEvent(closest && Math.abs(Number(closest.timeSec) - nextTime) < 0.8 ? closest : null);
  };

  const beginScrub = () => {
    if (!videoRef.current) return;
    scrubbingRef.current = true;
    setScrubbing(true);
    videoRef.current.pause();
  };

  const finishScrub = (force = false) => {
    if (!scrubbingRef.current && !force) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    const video = videoRef.current;
    if (!video) return;
    // Releasing the slider should immediately start a slow, continuous
    // playback from the chosen frame; no checkbox or mode selection needed.
    scrubAnchorRef.current = video.currentTime;
    video.playbackRate = 0.3;
    setDisplayRate(0.3);
    video.play().catch(() => {});
  };

  const jumpFromGraph = (time) => {
    scrubTo(time);
    finishScrub(true);
  };

  const updateVideoTime = (video) => {
    const time = video.currentTime;
    setCurrentTime(time);
    if (scrubbingRef.current) return;
    const eventTime = selectedEvent
      ? Number(selectedEvent.timeSec)
      : scrubAnchorRef.current ?? NaN;
    const targetRate = slowRateAt(time, eventTime);
    const nextRate = Math.max(0.3, Math.min(1, video.playbackRate + (targetRate - video.playbackRate) * 0.38));
    if (Math.abs(nextRate - video.playbackRate) > 0.01) video.playbackRate = nextRate;
    setDisplayRate(nextRate);
    if (selectedEvent && time > eventTime + 2) setSelectedEvent(null);
    if (scrubAnchorRef.current !== null && time > scrubAnchorRef.current + 2) scrubAnchorRef.current = null;
  };

  const orderedEvents = [...events]
    .filter(event => Number.isFinite(Number(event.timeSec)))
    .sort((a, b) => Number(a.timeSec) - Number(b.timeSec));
  const currentEventIndex = orderedEvents.findIndex(e => selectedEvent === e);
  const moveEvent = (offset) => {
    if (!orderedEvents.length) return;
    const index = currentEventIndex < 0 ? (offset > 0 ? 0 : orderedEvents.length - 1)
      : (currentEventIndex + offset + orderedEvents.length) % orderedEvents.length;
    playEvidence(orderedEvents[index]);
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
    ['관절 검출 신뢰도', formatValue(data.analysisConfidence, '%', 0)],
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
          <p>{statusText} · 사범 훈련 분석 · 기준 {data.standardVersion || '-'}</p>
        </div>
        <div className="score-ring" aria-label="참고 점수">
          <strong>{data.totalScore ?? '—'}</strong>
          <span>{data.totalScore == null ? '보류' : '참고 점수'}</span>
        </div>
      </header>

      <section className="priority-overview" aria-label="핵심 교정 요약">
        <div className="panel priority-good">
          <h3>잘한 점</h3>
          <p>{goodEvents.length ? goodEvents[0].detail : '자동으로 확인된 우수 구간이 없습니다. 영상을 확인하세요.'}</p>
        </div>
        <div className="panel priority-focus">
          <h3>먼저 교정할 점</h3>
          <p>{focusEvents.length ? focusEvents[0].detail : '중요 교정 이벤트가 발견되지 않았습니다. 분석의 정확도는 지도자와 확인하세요.'}</p>
        </div>
      </section>
      <p className="metric-note">AITM 점수는 프로젝트 측정 기준에 따른 참고 점수입니다. 관절 검출 신뢰도는 자세 채점 정확도와 다릅니다.</p>

      <div className="report-grid">
        <section className="panel video-review-panel">
          <div className="panel-title-row">
            <div>
              <h3>영상 근거 확인</h3>
              <p>관절 오버레이와 느린 재생으로 부족한 시점을 직접 확인합니다.</p>
            </div>
            <button onClick={onReset}>새 분석</button>
          </div>

          {referenceEmbed && (
            <section className="reference-compare" aria-label="사범 기준 영상">
              <div className="reference-header">
                <div><strong>유튜브 원본 기술 영상</strong><p>내 촬영 영상과 나란히 확인하는 시각적 참고 자료입니다. 관절값은 내 영상에서 측정합니다.</p></div>
                <button type="button" onClick={() => setShowReference(value => !value)}>
                  {showReference ? '기준 영상 접기' : '기준 영상 보기'}
                </button>
              </div>
              {showReference && (
                <div className="reference-video-frame">
                  <iframe title={`${skillName} 유튜브 기준 영상`} src={referenceEmbed}
                    loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
                    allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              )}
            </section>
          )}
          <h4 className="own-video-title">내 촬영 영상 · 실제 관절 분석</h4>
          <div className="video-overlay-wrap">
            {data.videoUrl ? (
              <video
                ref={videoRef}
                className="review-video"
                src={mediaUrl(data.videoUrl)}
                controls
                playsInline
                onTimeUpdate={(event) => updateVideoTime(event.currentTarget)}
                onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration || 0); syncCanvasSize(); }}
                onResize={syncCanvasSize}
              />
            ) : <div className="video-empty">저장된 영상이 없습니다.</div>}
            {data.videoUrl && <canvas ref={canvasRef} className={`pose-overlay ${overlayEnabled ? '' : 'hidden'}`} />}
          </div>

          <div className="slide-motion-controls">
            <div className="slide-motion-heading">
              <strong>손가락으로 밀어 동작 탐색</strong>
              <span>{currentTime.toFixed(2)} / {Number.isFinite(duration) ? duration.toFixed(2) : '0.00'}초 · {scrubbing ? '장면 탐색 중' : displayRate.toFixed(2) + '배속'}</span>
            </div>
            <input type="range" className="motion-slider" min="0" max={duration > 0 ? duration : 1}
              step="0.033" value={Math.min(currentTime, duration > 0 ? duration : 1)}
              style={{ '--played': `${duration > 0 ? currentTime / duration * 100 : 0}%` }}
              aria-label="손가락으로 밀어서 동작 시점 찾기. 손을 떼면 해당 지점부터 슬로우 재생됩니다."
              onPointerDown={beginScrub}
              onPointerUp={() => finishScrub()}
              onPointerCancel={() => finishScrub()}
              onTouchEnd={() => finishScrub()}
              onKeyUp={() => finishScrub(true)}
              onBlur={() => finishScrub()}
              onChange={e => scrubTo(Number(e.target.value))} disabled={!data.videoUrl || duration <= 0} />
            <div className="motion-timeline-markers" aria-label="측정된 동작 시점 표시">
              {duration > 0 && orderedEvents.map((event, index) => (
                <button type="button" key={`marker-${event.label}-${index}`}
                  className={`motion-marker ${event.severity === 'warning' ? 'needs-review' : ''}`}
                  style={{ left: `${Math.max(1, Math.min(99, Number(event.timeSec) / duration * 100))}%` }}
                  title={`${event.label} ${Number(event.timeSec).toFixed(2)}초`}
                  aria-label={`${event.label} 동작으로 이동`}
                  onClick={() => playEvidence(event)} />
              ))}
            </div>
            <div className="motion-slider-actions">
              <button type="button" onClick={() => moveEvent(-1)} disabled={!orderedEvents.length}>이전 동작</button>
              <button type="button" onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) video.play().catch(() => {});
                else video.pause();
              }}>재생 / 일시정지</button>
              <button type="button" onClick={() => moveEvent(1)} disabled={!orderedEvents.length}>다음 동작</button>
            </div>
            <p className="metric-note">슬라이더를 좌우로 밀어 장면을 찾으세요. 손을 떼면 그 장면부터 약 0.3배속으로 시작해 자연스럽게 정상 속도로 이어집니다. 색 점은 실제 측정된 핵심 동작입니다.</p>
          </div>
          {selectedEvent && (
            <div className="evidence-active" role="status">
              <strong>{selectedEvent.label} · 실제 측정 시점 {Number(selectedEvent.timeSec).toFixed(2)}초</strong>
              <p>{selectedEvent.detail}</p>
            </div>
          )}
          <div className="review-controls">
            <button className={overlayEnabled ? 'active' : ''} onClick={() => setOverlayEnabled(value => !value)}>관절 표시 {overlayEnabled ? '끄기' : '켜기'}</button>
          </div>
          <div className="event-list">
            <h4>동작 구간 슬라이드</h4>
            <div className="motion-event-rail" aria-label="측정된 주요 동작">
              {orderedEvents.map((event, index) => (
                <button key={`${event.label}-${index}`} type="button"
                  className={`event-card ${event.severity || ''} ${selectedEvent === event ? 'selected' : ''}`}
                  onClick={() => playEvidence(event)}>
                  <span className="event-time">{Number(event.timeSec).toFixed(2)}초</span>
                  <span className="event-body"><strong>{event.label}</strong><small>{event.detail}</small></span>
                  <span className="event-action">{event.severity === 'warning' ? '교정할 동작' : '기술 기준 확인'}</span>
                </button>
              ))}
              {!orderedEvents.length && <p className="empty-copy">측정된 주요 동작이 없습니다. 분석 근거가 없어 임의의 동작을 표시하지 않습니다.</p>}
            </div>
          </div>
        </section>


      </div>

      <AnalysisMetricsGraph frames={poseFrames} snapshot={data.standardSnapshotJson}
        selectedTime={currentTime} onSeek={jumpFromGraph} />

      <section className="panel coaching-panel">
        <div>
          <h3>AI 코칭</h3>
          <p className="coaching-text">{data.aiFeedback || '코칭 결과가 없습니다.'}</p>
        </div>
        <details className="evidence-box">
          <summary>평가 기준과 출처 보기</summary>
          <span>기준 버전: {data.standardVersion || '-'}</span>
          <span>출처: {data.standardSourceName || '-'}</span>
          <span>검증 상태: {data.standardVerified ? '지도자/전문가 검증됨' : '프로젝트 기준 · 검증 전'}</span>
          {sources.map((source) => <span key={source}>{source}</span>)}
        </details>
      </section>

      <details className="panel expert-details">
        <summary>전문 분석 보기 · 측정 지표와 점수 근거</summary>
        <div className="metrics-panel">
          <h3>측정 지표</h3>
          <div className="metric-grid">
            {metrics.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <h3 className="subheading">점수 근거</h3>
          <ScoreBreakdown value={data.scoreBreakdownJson} />
          <p className="metric-note">회전 속도와 점프 높이는 단일 카메라 Pose 기반 추정치이며 계측 장비의 절대값과 동일하지 않습니다.</p>
        </div>
      </details>

      {warnings.length > 0 && <section className="panel warning-panel"><h3>촬영 품질 확인</h3>{warnings.map((warning) => <p key={warning}>• {warning}</p>)}</section>}
    </div>
  );
}

export default AnalysisReport;
