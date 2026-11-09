import { useEffect, useMemo, useRef, useState } from 'react';
import AnalysisMetricsGraph from './AnalysisMetricsGraph';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function json(value, fallback) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; }
  catch { return fallback; }
}

export default function ReferenceComparison({ data, ownEvents, onChooseOwnEvent }) {
  const videoRef = useRef(null);
  const [referenceTime, setReferenceTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [speed, setSpeed] = useState(1);
  const slowdownOrigin = useRef(null);
  const measured = useMemo(() => json(data.referenceMeasurementsJson, {}), [data.referenceMeasurementsJson]);
  const frames = useMemo(() => json(data.referencePoseFramesJson, []), [data.referencePoseFramesJson]);
  const refEvents = useMemo(() => json(data.referenceAnalysisEventsJson, []), [data.referenceAnalysisEventsJson]);
  const differences = measured.differences || [];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1;
  }, [data.referencePlaybackUrl]);

  if (!data.referencePlaybackUrl) return null;

  const seek = value => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(Number.isFinite(video.duration) ? video.duration : value, Math.max(0, value));
    video.pause();
    video.currentTime = next;
    setReferenceTime(next);
  };

  const startSlow = () => {
    const video = videoRef.current;
    if (!video) return;
    setScrubbing(false);
    slowdownOrigin.current = video.currentTime;
    video.playbackRate = 0.3;
    setSpeed(0.3);
    video.play().catch(() => {});
  };

  const onVideoTime = video => {
    const t = video.currentTime;
    setReferenceTime(t);
    if (slowdownOrigin.current === null) return;
    const distance = Math.abs(t - slowdownOrigin.current);
    const normalized = Math.min(1, distance / 1.6);
    const eased = normalized * normalized * (3 - 2 * normalized);
    const next = 0.3 + 0.7 * eased;
    if (Math.abs(video.playbackRate - next) > 0.02) video.playbackRate = next;
    setSpeed(next);
    if (distance > 1.8) slowdownOrigin.current = null;
  };

  const choosePhase = (event) => {
    const match = ownEvents.find(item => item.label === event.label);
    seek(Math.max(0, Number(event.timeSec) - 0.8));
    startSlow();
    if (match) onChooseOwnEvent(match);
  };

  return (
    <section className="panel comparison-panel" aria-label="원본 영상 대 내 동작 측정 비교">
      <div className="panel-title-row">
        <div>
          <h3>기준 원본 영상과 내 동작 비교</h3>
          <p>두 파일에 동일한 Python Pose 분석과 평가 기준을 적용했습니다. 내 점수와 기존 교정 기준은 변경하지 않았습니다.</p>
        </div>
      </div>
      <div className="reference-comparison-content">
        <div className="comparison-clip">
          <strong>기준 원본 · 실제 관절 분석 완료</strong>
          <video ref={videoRef} src={data.referencePlaybackUrl.startsWith('/') ? API_BASE_URL + data.referencePlaybackUrl : data.referencePlaybackUrl}
            controls playsInline preload="metadata"
            onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={e => onVideoTime(e.currentTarget)} />
          <label className="comparison-timeline-label" htmlFor="reference-scrub">
            기준 영상 슬라이더
            <span>{referenceTime.toFixed(2)}초 · {scrubbing ? '탐색 중' : speed.toFixed(2) + '배속'}</span>
          </label>
          <input id="reference-scrub" className="motion-slider" type="range" min="0" step="0.033"
            max={duration || 1} value={Math.min(referenceTime, duration || 1)}
            onPointerDown={() => { setScrubbing(true); videoRef.current?.pause(); }}
            onPointerUp={startSlow} onPointerCancel={startSlow}
            onTouchEnd={startSlow} onKeyUp={startSlow}
            onChange={e => seek(Number(e.target.value))} disabled={!duration} />
          <p className="helper-text">손가락으로 찾고 놓으면 0.3배속부터 자연스럽게 재생됩니다.</p>
        </div>
        <div className="comparison-steps">
          <strong>같은 동작 구간 찾기</strong>
          <p className="helper-text">두 영상의 무릎 수축·회전 피크·착지 시점을 각각 측정합니다. 버튼을 누르면 양쪽 영상에서 같은 이름의 동작 구간으로 이동합니다.</p>
          <div className="comparison-phase-buttons">
            {refEvents.filter(e => Number.isFinite(Number(e.timeSec))).map((event, i) => (
              <button type="button" key={event.label + i} onClick={() => choosePhase(event)}>
                <strong>{event.label}</strong>
                <span>{Number(event.timeSec).toFixed(2)}초 · {ownEvents.some(e => e.label === event.label) ? '양쪽 비교' : '원본만 보기'}</span>
              </button>
            ))}
            {!refEvents.length && <p className="helper-text">비교할 기준 영상 동작 시점이 없습니다.</p>}
          </div>
        </div>
      </div>
      <h4>같은 Pose 엔진에서 계산한 측정값 차이</h4>
      <div className="comparison-differences">
        {differences.map(row => (
          <div className="comparison-difference" key={row.metric}>
            <strong>{row.label}</strong>
            <span>내 영상 {row.mine}{row.unit}</span>
            <span>원본 {row.reference}{row.unit}</span>
            <span>차이 {row.delta > 0 ? '+' : ''}{row.delta}{row.unit}</span>
          </div>
        ))}
        {!differences.length && <p className="helper-text">비교 가능한 공통 측정값이 부족합니다.</p>}
      </div>
      <p className="metric-note">{measured.note || '측정값 차이는 품질 순위가 아니며, 카메라 시점과 환경에 따라 달라질 수 있습니다.'}</p>
      <details className="comparison-detail-graph">
        <summary>기준 원본 영상의 동작 그래프 보기</summary>
        <AnalysisMetricsGraph frames={frames} snapshot={data.standardSnapshotJson}
          selectedTime={referenceTime} onSeek={t => { seek(t); startSlow(); }} />
      </details>
    </section>
  );
}
