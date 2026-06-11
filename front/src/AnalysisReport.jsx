import React from 'react';
import './AnalysisReport.css';

/**
 * AI 분석 결과 시각화 및 피드백 리포트 컴포넌트
 */
const AnalysisReport = ({ data, standards, onReset }) => {
  if (!data) return null;

  // 점수 구간별 기술 숙련도 매핑
  const getTierInfo = (score) => {
    const s = score || 0;
    if (s >= 95) return { label: "마스터", desc: "태권도 정점 수준의 기술 완성도입니다." };
    if (s >= 85) return { label: "우수", desc: "매우 안정적이고 강력한 동작을 구사합니다." };
    if (s >= 75) return { label: "심화", desc: "기술의 메커니즘을 정확히 이해하고 있습니다." };
    if (s >= 65) return { label: "보통", desc: "기본기가 탄탄하며 실전 활용이 가능한 수준입니다." };
    if (s >= 50) return { label: "기초", desc: "지속적인 반복 숙달과 기본기 교정이 필요합니다." };
    return { label: "미흡", desc: "동작의 기초 원리부터 재학습을 권장합니다." };
  };

  const skillName = standards.find(s => s.moveType === data.moveType)?.skillName || data.moveType;
  const tier = getTierInfo(data.totalScore);

  return (
    <div className="detailed-report-view">
      <header className="report-main-header">
        <div className="skill-label-box">
          <p className="report-type-label">Kinematics Analysis Report</p>
          <h1 className="main-skill-name">{skillName}</h1>
        </div>
        <div className="header-actions">
          <button className="new-session-btn" onClick={onReset}>New Session</button>
        </div>
      </header>

      <div className="report-content">
        {/* 점수 및 티어 요약 */}
        <section className="score-summary">
          <div className="score-box">
            <h2>Total Score: {Math.round(data.totalScore || 0)}</h2>
            <div className="tier-info">
              <span className="tier-label">판정결과: {tier.label}</span>
              <p className="tier-desc">{tier.desc}</p>
            </div>
          </div>
        </section>

        <div className="report-data-grid">
          {/* RAG 생성 피드백 섹션 */}
          <section className="ai-feedback-section">
            <h3>AI Master Coaching</h3>
            <div className="feedback-box">
              <p>{data.aiFeedback}</p>
            </div>
          </section>

          {/* 주요 물리 지표 테이블 */}
          <section className="physics-data-section">
            <h3>Biomechanical Metrics</h3>
            <div className="metrics-table">
              <MetricItem label="어깨 가속도" value={data.shoulderAccel} unit="rad/s²" />
              <MetricItem label="상체 추진력" value={data.upperBodyMomentum} unit="kg·m/s" />
              <MetricItem label="최대 각속도" value={data.rotationAngularVelocity} unit="deg/s" />
              <MetricItem label="총 회전수" value={(data.totalRotationDeg || 0) / 360} unit="바퀴" decimals={1} />
              <MetricItem label="무릎 수축 속도" value={data.kneeTuckTransitionMs} unit="ms" />
              <MetricItem label="수직 도약 높이" value={data.jumpBoostHeightCm} unit="cm" />
              <MetricItem label="시선-타격 동기화" value={data.timingSyncScore} unit="%" />
              <MetricItem label="착지 안정성" value={data.landingStabilityScore} unit="/ 100" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const MetricItem = ({ label, value, unit, decimals = 0 }) => (
  <div className="metric-item">
    <span className="metric-label">{label}</span>
    <span className="metric-value">
      {decimals > 0 ? Number(value || 0).toFixed(decimals) : Math.round(value || 0)} {unit}
    </span>
  </div>
);

export default AnalysisReport;
