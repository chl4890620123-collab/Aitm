import { useEffect, useState } from 'react';
import axios from 'axios';
import './KnowledgeManager.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const emptyForm = {
  moveType: '',
  skillName: '',
  description: '',
  idealKneeMinDeg: 90,
  minRotationVelocityDegSec: 280,
  minLandingStabilityScore: 75,
  coachingMessage: '',
};

function KnowledgeManager({ onDataChange }) {
  const [standards, setStandards] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [standardResponse, knowledgeResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/standards`),
      axios.get(`${API_BASE_URL}/api/knowledge`),
    ]);
    setStandards(standardResponse.data || []);
    setKnowledge(knowledgeResponse.data || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const saveSkill = async () => {
    if (!form.moveType.trim() || !form.skillName.trim()) {
      setMessage('기술명과 기술 코드를 입력하세요.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/standards`, {
        moveType: form.moveType.trim(),
        skillName: form.skillName.trim(),
        description: `${form.description} 기준값은 프로젝트 기준이며 지도자 검증 후 수정할 수 있습니다.`.trim(),
        standardData: JSON.stringify({
          idealKneeMinDeg: Number(form.idealKneeMinDeg),
          kneeToleranceDeg: 20,
          minRotationVelocityDegSec: Number(form.minRotationVelocityDegSec),
          minLandingStabilityScore: Number(form.minLandingStabilityScore),
          idealKneeToRotationMs: 180,
          timingToleranceMs: 180,
        }),
      });
      await axios.post(`${API_BASE_URL}/api/knowledge`, {
        technicalPoint: `${form.skillName} 코칭`,
        criteriaValue: Number(form.idealKneeMinDeg),
        coachingMessage: form.coachingMessage || `${form.skillName}의 실제 측정값을 기준 영상과 비교해 가장 큰 차이부터 교정합니다.`,
      });
      setForm(emptyForm);
      setMessage('기술 기준을 저장했습니다.');
      await load();
      onDataChange?.();
    } catch (error) {
      console.error(error);
      setMessage(error?.response?.data?.message || '저장하지 못했습니다.');
    }
  };

  const removeStandard = async (id) => {
    if (!window.confirm('이 기술 기준을 삭제할까요?')) return;
    await axios.delete(`${API_BASE_URL}/api/standards/${id}`);
    await load();
    onDataChange?.();
  };

  return (
    <div className="knowledge-page">
      <header className="simple-page-header">
        <div>
          <p className="section-kicker">PROJECT STANDARDS</p>
          <h2>기준 관리</h2>
          <p>공식 규정값이 아니라 프로젝트 분석 기준입니다. 실제 코치 검증값으로 교체할 수 있습니다.</p>
        </div>
      </header>

      <div className="knowledge-grid">
        <section className="panel standard-form">
          <h3>새 기술 기준</h3>
          <div className="form-grid">
            <label>기술명<input value={form.skillName} onChange={(e) => setForm({ ...form, skillName: e.target.value })} placeholder="예: 돌개차기" /></label>
            <label>기술 코드<input value={form.moveType} onChange={(e) => setForm({ ...form, moveType: e.target.value })} placeholder="예: dolgechigi" /></label>
            <label>무릎 목표 각도<input type="number" value={form.idealKneeMinDeg} onChange={(e) => setForm({ ...form, idealKneeMinDeg: e.target.value })} /></label>
            <label>최소 회전 각속도<input type="number" value={form.minRotationVelocityDegSec} onChange={(e) => setForm({ ...form, minRotationVelocityDegSec: e.target.value })} /></label>
            <label>최소 착지 안정성<input type="number" value={form.minLandingStabilityScore} onChange={(e) => setForm({ ...form, minLandingStabilityScore: e.target.value })} /></label>
          </div>
          <label>설명<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>코칭 지식<textarea value={form.coachingMessage} onChange={(e) => setForm({ ...form, coachingMessage: e.target.value })} /></label>
          <button className="primary" onClick={saveSkill}>기준 저장</button>
          {message && <p className="helper-text">{message}</p>}
        </section>

        <section className="panel standards-list">
          <h3>등록된 기술</h3>
          {standards.map((item) => (
            <div className="standard-row" key={item.id}>
              <div><strong>{item.skillName}</strong><span>{item.moveType}</span></div>
              <button className="text-danger" onClick={() => removeStandard(item.id)}>삭제</button>
            </div>
          ))}
          <div className="knowledge-count">RAG 코칭 지식 {knowledge.length}개</div>
        </section>
      </div>
    </div>
  );
}

export default KnowledgeManager;
