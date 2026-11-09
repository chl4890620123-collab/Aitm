import { useEffect, useState } from 'react';
import axios from 'axios';
import { getYouTubeVideoId } from './youtube';
import './KnowledgeManager.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const emptyForm = {
  moveType: '', skillName: '', description: '', idealKneeMinDeg: 90, kneeToleranceDeg: 20,
  minRotationVelocityDegSec: 280, minLandingStabilityScore: 75, idealKneeToRotationMs: 180,
  timingToleranceMs: 180, coachingMessage: '', standardVersion: '0.1',
  sourceName: '', sourceUrl: '', referenceVideoUrl: '', injuryPrevention: '', verified: false,
};

function parseStandard(value) {
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function KnowledgeManager({ onDataChange }) {
  const [standards, setStandards] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [existingStandardData, setExistingStandardData] = useState({});
  const [message, setMessage] = useState('');

  const load = async () => {
    const [standardResponse, knowledgeResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/standards`),
      axios.get(`${API_BASE_URL}/api/knowledge`),
    ]);
    setStandards(standardResponse.data || []);
    setKnowledge(knowledgeResponse.data || []);
  };

  useEffect(() => { load().catch(console.error); }, []);

  const editSkill = (item) => {
    const saved = parseStandard(item.standardData);
    const originalKnowledge = knowledge.find(k => k.technicalPoint === item.skillName + ' 코칭');
    setEditingId(item.id);
    setExistingStandardData(saved);
    setForm({
      ...emptyForm,
      ...item,
      idealKneeMinDeg: saved.idealKneeMinDeg ?? emptyForm.idealKneeMinDeg,
      kneeToleranceDeg: saved.kneeToleranceDeg ?? emptyForm.kneeToleranceDeg,
      minRotationVelocityDegSec: saved.minRotationVelocityDegSec ?? emptyForm.minRotationVelocityDegSec,
      minLandingStabilityScore: saved.minLandingStabilityScore ?? emptyForm.minLandingStabilityScore,
      idealKneeToRotationMs: saved.idealKneeToRotationMs ?? emptyForm.idealKneeToRotationMs,
      timingToleranceMs: saved.timingToleranceMs ?? emptyForm.timingToleranceMs,
      sourceUrl: item.sourceUrl || '',
      referenceVideoUrl: item.referenceVideoUrl || '',
      injuryPrevention: item.injuryPrevention || '',
      coachingMessage: originalKnowledge?.coachingMessage || '',
    });
    setMessage('기존 기술을 편집 중입니다. 분석에 사용된 과거 기준 스냅샷은 변경되지 않습니다.');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExistingStandardData({});
    setForm(emptyForm);
    setMessage('');
  };

  const saveSkill = async () => {
    if (!form.moveType.trim() || !form.skillName.trim()) { setMessage('기술명과 기술 코드를 입력하세요.'); return; }
    if (!form.sourceName.trim()) { setMessage('평가 기준의 출처를 입력하세요. 검증 전 기준이면 그 사실을 그대로 적어주세요.'); return; }
    if (form.referenceVideoUrl.trim() && !getYouTubeVideoId(form.referenceVideoUrl.trim())) {
      setMessage('유튜브 시범 영상은 올바른 HTTPS YouTube URL을 입력하세요.');
      return;
    }
    const fields = ['idealKneeMinDeg', 'kneeToleranceDeg', 'minRotationVelocityDegSec',
      'minLandingStabilityScore', 'idealKneeToRotationMs', 'timingToleranceMs'];
    if (fields.some(name => !Number.isFinite(Number(form[name])) || Number(form[name]) < 0)) {
      setMessage('기술 기준값에는 0 이상의 숫자를 입력하세요.');
      return;
    }
    if (editingId && standards.find(x => x.id === editingId)?.standardVersion === form.standardVersion.trim()) {
      setMessage('기존 기준을 수정할 때는 버전을 변경해 주세요. 과거 분석과 현재 기준을 구분하는 데 필요합니다.');
      return;
    }
    try {
      const payload = {
        moveType: form.moveType.trim(), skillName: form.skillName.trim(),
        description: form.description.trim(),
        standardVersion: form.standardVersion.trim() || '0.1',
        sourceName: form.sourceName.trim(), sourceUrl: form.sourceUrl.trim(),
        referenceVideoUrl: form.referenceVideoUrl.trim(), injuryPrevention: form.injuryPrevention.trim(),
        verified: Boolean(form.verified),
        standardData: JSON.stringify({
          ...existingStandardData,
          ...Object.fromEntries(fields.map(name => [name, Number(form[name])])),
        }),
      };
      if (editingId) await axios.put(`${API_BASE_URL}/api/standards/${editingId}`, payload);
      else await axios.post(`${API_BASE_URL}/api/standards`, payload);
      if (form.coachingMessage.trim()) {
        const existing = knowledge.find(k => k.technicalPoint === form.skillName.trim() + ' 코칭');
        const knowledgePayload = { technicalPoint: form.skillName.trim() + ' 코칭',
          criteriaValue: Number(form.idealKneeMinDeg), coachingMessage: form.coachingMessage.trim() };
        if (existing) await axios.put(`${API_BASE_URL}/api/knowledge/${existing.id}`, knowledgePayload);
        else await axios.post(`${API_BASE_URL}/api/knowledge`, knowledgePayload);
      }
      cancelEdit(); setMessage(editingId ? '기술 기준을 새 버전으로 업데이트했습니다.' : '새 기술을 등록했습니다.');
      await load(); onDataChange?.();
    } catch (error) {
      console.error(error); setMessage(error?.response?.data?.message || '저장하지 못했습니다.');
    }
  };

  const removeStandard = async (id) => {
    if (!window.confirm('이 기술 기준을 삭제할까요?')) return;
    await axios.delete(`${API_BASE_URL}/api/standards/${id}`); await load(); onDataChange?.();
  };

  return (
    <div className="knowledge-page">
      <header className="simple-page-header"><div><p className="section-kicker">PROJECT STANDARDS</p><h2>기준 관리</h2><p>기준값의 출처·버전·검증 상태를 함께 관리해 과거 분석 결과를 재현할 수 있습니다.</p></div></header>
      <div className="knowledge-grid">
        <section className="panel standard-form">
          <h3>{editingId ? '기술 기준 편집 · 새 버전 저장' : '새 기술 기준 등록'}</h3>
          <div className="form-grid">
            <label>기술명<input value={form.skillName} onChange={(e) => setForm({ ...form, skillName: e.target.value })} placeholder="예: 돌개차기" /></label>
            <label>기술 코드<input value={form.moveType} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, moveType: e.target.value })} placeholder="예: dolgechigi" /></label>
            <label>기준 버전<input value={form.standardVersion} onChange={(e) => setForm({ ...form, standardVersion: e.target.value })} placeholder="0.1" /></label>
            <label>기준 출처<input value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} placeholder="예: 지도자 A 검증 데이터" /></label>
            <label>출처 URL<input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." /></label>
            <label>유튜브 시범 영상<input type="url" value={form.referenceVideoUrl} onChange={(e) => setForm({ ...form, referenceVideoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></label>
            <label className="check-label"><input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} /> 지도자/전문가 검증 완료</label>
            <label>무릎 목표 각도<input type="number" value={form.idealKneeMinDeg} onChange={(e) => setForm({ ...form, idealKneeMinDeg: e.target.value })} /></label>
            <label>무릎 각도 허용 오차<input type="number" value={form.kneeToleranceDeg} onChange={(e) => setForm({ ...form, kneeToleranceDeg: e.target.value })} /></label>
            <label>최소 회전 각속도<input type="number" value={form.minRotationVelocityDegSec} onChange={(e) => setForm({ ...form, minRotationVelocityDegSec: e.target.value })} /></label>
            <label>최소 착지 안정성<input type="number" value={form.minLandingStabilityScore} onChange={(e) => setForm({ ...form, minLandingStabilityScore: e.target.value })} /></label>
            <label>무릎-회전 간격 기준(ms)<input type="number" value={form.idealKneeToRotationMs} onChange={(e) => setForm({ ...form, idealKneeToRotationMs: e.target.value })} /></label>
            <label>타이밍 오차 기준(ms)<input type="number" value={form.timingToleranceMs} onChange={(e) => setForm({ ...form, timingToleranceMs: e.target.value })} /></label>
          </div>
          <label>설명<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>훈련 안전·주의 사항<textarea value={form.injuryPrevention} onChange={(e) => setForm({ ...form, injuryPrevention: e.target.value })} /></label>
          <label>코칭 지식<textarea value={form.coachingMessage} onChange={(e) => setForm({ ...form, coachingMessage: e.target.value })} /></label>
          <button className="primary" onClick={saveSkill}>{editingId ? '새 버전으로 수정 저장' : '새 기술 등록'}</button>
          {editingId && <button type="button" className="primary" onClick={cancelEdit}>편집 취소</button>}
          {message && <p className="helper-text">{message}</p>}
        </section>
        <section className="panel standards-list">
          <h3>등록된 기술</h3>
          {standards.map((item) => (
            <div className="standard-row" key={item.id}>
              <div><strong>{item.skillName}</strong><span>{item.moveType} · v{item.standardVersion || '0.1'} · {item.verified ? '검증됨' : '검증 전'}</span><small>{item.sourceName || '출처 미지정'}</small></div>
              <div className="standard-actions">
                <button type="button" onClick={() => editSkill(item)}>편집</button>
                <button type="button" className="text-danger" onClick={() => removeStandard(item.id)}>삭제</button>
              </div>
            </div>
          ))}
          <div className="knowledge-count">RAG 코칭 지식 {knowledge.length}개</div>
        </section>
      </div>
    </div>
  );
}

export default KnowledgeManager;
