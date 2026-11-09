import { useState } from 'react';
import { getYouTubeEmbed } from './youtube';

function standardValues(value) {
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

// Reuse the source, thresholds, description and reference clip already maintained
// by the instructor. Do not invent an unseen technique or its physical criteria.
export default function SkillGuide({ skill, selectedReferenceUrl }) {
  const [opened, setOpened] = useState(false);
  if (!skill) return null;
  const standard = standardValues(skill.standardData);
  const youtube = getYouTubeEmbed(selectedReferenceUrl || skill.referenceVideoUrl);
  const checks = [
    ['무릎 준비', 'idealKneeMinDeg', '°'],
    ['회전 구간', 'minRotationVelocityDegSec', 'deg/s'],
    ['착지 안정성', 'minLandingStabilityScore', '/100'],
  ].filter(([, key]) => Number.isFinite(Number(standard[key])));

  return (
    <section className="panel skill-guide" aria-label="기술 연습 가이드">
      <div className="skill-guide-heading">
        <div>
          <p className="section-kicker">SELF TRAINING FOR MASTERS</p>
          <h3>선택한 기술 미리 익히기 · {skill.skillName}</h3>
          <p>등록된 기술 자료를 확인하고, 촬영한 동작을 같은 분석 기준으로 평가합니다.</p>
        </div>
        <button type="button" onClick={() => setOpened(v => !v)} aria-expanded={opened}>
          {opened ? '가이드 접기' : '기술 가이드 보기'}
        </button>
      </div>
      {opened && (
        <div className="skill-guide-body">
          <div className="skill-guide-notes">
            <h4>기술 설명</h4>
            <p>{skill.description || '등록된 설명이 없습니다. 관리자가 기술 설명을 추가할 수 있습니다.'}</p>
            <h4>교정 시 확인할 측정 구간</h4>
            <div className="skill-check-grid">
              {checks.map(([title, key, unit]) => (
                <div className="skill-check" key={key}>
                  <strong>{title}</strong>
                  <span>{standard[key]}{unit} · 등록된 프로젝트 기준</span>
                </div>
              ))}
              {!checks.length && <p>측정 기준이 등록되지 않았습니다.</p>}
            </div>
            <h4>안전 및 주의</h4>
            <p>{skill.injuryPrevention || '불편함이나 통증이 있다면 동작을 중단하고 지도자 또는 전문가와 확인하세요.'}</p>
            <p className="helper-text">
              자료 출처: {skill.sourceName || '미등록'} · v{skill.standardVersion || '0.1'} · {skill.verified ? '지도자 검증 표시' : '전문가 검증 전'}
            </p>
          </div>
          {youtube && (
            <div className="skill-reference-video">
              <h4>유튜브 시범 영상 · 시청용</h4>
              <div className="youtube-video-frame">
                <iframe title={skill.skillName + ' 시범 영상'} src={youtube}
                  loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
              </div>
              <p className="helper-text">이 영상은 눈으로 기술을 익히는 자료입니다. 자세 비교 계산은 업로드된 원본 파일만 수행합니다.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
