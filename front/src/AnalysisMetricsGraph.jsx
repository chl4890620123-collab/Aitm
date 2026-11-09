import { useMemo } from 'react';

function parseJson(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || {}; }
  catch { return {}; }
}

const WIDTH = 760;
const HEIGHT = 190;
const PLOT = { left: 54, right: 22, top: 16, bottom: 38 };

function TimeSeries({ title, subtitle, points, keyName, target, tolerance, fixedMax, color, unit, selectedTime, onSeek }) {
  const valid = useMemo(() => points
    .filter(point => Number.isFinite(Number(point.timeSec)) && Number.isFinite(Number(point[keyName])))
    .sort((a, b) => Number(a.timeSec) - Number(b.timeSec)), [points, keyName]);
  if (valid.length < 2) {
    return <div className="graph-empty">이전 기록에는 그래프를 위한 연속 측정값이 없습니다. 새 영상을 분석하면 표시됩니다.</div>;
  }
  const times = valid.map(row => Number(row.timeSec));
  const values = valid.map(row => Number(row[keyName]));
  const tMin = times[0];
  const tMax = Math.max(tMin + 0.1, times[times.length - 1]);
  const yMin = 0;
  const yMax = Math.max(fixedMax || 0, ...values, Number(target) || 0, 1) * (fixedMax ? 1 : 1.12);
  const plotW = WIDTH - PLOT.left - PLOT.right;
  const plotH = HEIGHT - PLOT.top - PLOT.bottom;
  const x = t => PLOT.left + (t - tMin) / (tMax - tMin) * plotW;
  const y = value => PLOT.top + (1 - Math.min(yMax, Math.max(yMin, value)) / yMax) * plotH;
  const line = valid.map((row, index) => (index === 0 ? 'M ' : 'L ') + x(Number(row.timeSec)).toFixed(1) + ' ' + y(Number(row[keyName])).toFixed(1)).join(' ');
  const targetValid = Number.isFinite(target) && target >= 0;
  const bandTop = targetValid && tolerance > 0 ? y(target + tolerance) : 0;
  const bandBottom = targetValid && tolerance > 0 ? y(Math.max(0, target - tolerance)) : 0;
  const cursorValid = Number.isFinite(selectedTime) && selectedTime >= tMin && selectedTime <= tMax;

  const seek = event => {
    if (!onSeek) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const position = Math.max(0, Math.min(1, (ratio * WIDTH - PLOT.left) / plotW));
    onSeek(tMin + position * (tMax - tMin));
  };

  return (
    <div className="time-series">
      <div className="graph-heading"><strong>{title}</strong><span>{subtitle}</span></div>
      <svg viewBox="0 0 760 190" role="img" aria-label={title + ': 실제 측정 추이, 가로축 초, 세로축 ' + unit}
        onClick={seek} className="metrics-svg">
        <rect x={PLOT.left} y={PLOT.top} width={plotW} height={plotH} fill="#f8fafc" />
        {[0, 0.5, 1].map(i => (
          <g key={i}>
            <line x1={PLOT.left} y1={y(yMax * i)} x2={WIDTH - PLOT.right} y2={y(yMax * i)} stroke="#dce3ed" strokeDasharray="3 4" />
            <text x={PLOT.left - 10} y={y(yMax * i) + 4} textAnchor="end" fontSize="11" fill="#667085">{Math.round(yMax * i)}</text>
          </g>
        ))}
        {targetValid && tolerance > 0 && (
          <rect x={PLOT.left} y={bandTop} width={plotW} height={Math.max(0, bandBottom - bandTop)} fill="#d9f0de" opacity="0.7" />
        )}
        {targetValid && <line x1={PLOT.left} y1={y(target)} x2={WIDTH - PLOT.right} y2={y(target)} stroke="#148447" strokeWidth="1.6" strokeDasharray="7 5" />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {cursorValid && <line x1={x(selectedTime)} y1={PLOT.top} x2={x(selectedTime)} y2={HEIGHT - PLOT.bottom} stroke="#111827" strokeWidth="1.2" strokeDasharray="3 3" />}
        {[tMin, (tMin + tMax) / 2, tMax].map((t, i) =>
          <text key={i} x={x(t)} y={HEIGHT - 11} fontSize="11" fill="#667085" textAnchor="middle">{t.toFixed(1)}초</text>
        )}
      </svg>
      <div className="graph-legend">
        <span><i style={{ background: color }} /> 실제 측정</span>
        {targetValid && <span><i style={{ background: '#148447' }} /> 등록 기준: {target}{unit}{tolerance > 0 ? ' ± ' + tolerance + unit : ''}</span>}
      </div>
    </div>
  );
}

export default function AnalysisMetricsGraph({ frames, snapshot, selectedTime, onSeek }) {
  const standard = parseJson(parseJson(snapshot).standardData);
  const kneeTarget = Number(standard.idealKneeMinDeg);
  const kneeTol = Number(standard.kneeToleranceDeg);
  const rotationTarget = Number(standard.minRotationVelocityDegSec);
  const hasKnee = Number.isFinite(kneeTarget) && kneeTarget > 0;
  const hasRotation = Number.isFinite(rotationTarget) && rotationTarget > 0;

  return (
    <section className="panel metrics-graph-panel">
      <div className="panel-title-row">
        <div>
          <h3>실제 동작 변화 그래프</h3>
          <p>영상을 분석한 실제 관절 측정값입니다. 그래프를 누르면 해당 시점의 영상으로 이동합니다.</p>
        </div>
      </div>
      <div className="time-series-grid">
        <TimeSeries title="무릎 각도" subtitle="동작 전후 각도 변화" points={frames} keyName="kneeAngleDeg"
          fixedMax={180} target={hasKnee ? kneeTarget : NaN} tolerance={hasKnee && Number.isFinite(kneeTol) ? kneeTol : 0}
          color="#2563eb" unit="°" selectedTime={selectedTime} onSeek={onSeek} />
        <TimeSeries title="골반 회전 각속도" subtitle="단일 카메라의 회전 속도 추정치" points={frames} keyName="hipRotationVelocityDegSec"
          target={hasRotation ? rotationTarget : NaN} color="#8b5cf6" unit="deg/s" selectedTime={selectedTime} onSeek={onSeek} />
      </div>
      <p className="metric-note">녹색 선은 등록된 기술 기준값입니다. 전문가 검증 여부는 하단 평가 기준에서 확인할 수 있습니다. 측정값과 기준값의 차이는 지도자 판단을 대체하지 않습니다.</p>
    </section>
  );
}
