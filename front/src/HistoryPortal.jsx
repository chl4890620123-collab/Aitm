import { useEffect, useState } from 'react';
import axios from 'axios';
import './HistoryPortal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function HistoryPortal({ standards, onViewDetail }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/analysis/history`);
      setHistory(response.data || []);
      setError('');
    } catch (requestError) {
      console.error(requestError);
      setError('분석 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const deleteHistory = async (id) => {
    if (!window.confirm('이 분석 기록을 삭제할까요?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/analysis/${id}`);
      setHistory((items) => items.filter((item) => item.resultId !== id));
    } catch (requestError) {
      console.error(requestError);
      setError('기록을 삭제하지 못했습니다.');
    }
  };

  if (loading) return <div className="center-state">기록을 불러오는 중...</div>;

  return (
    <div className="history-page">
      <header className="simple-page-header">
        <div>
          <p className="section-kicker">ANALYSIS HISTORY</p>
          <h2>분석 기록</h2>
          <p>저장된 영상을 다시 열어 같은 문제 구간을 느린 재생으로 확인할 수 있습니다.</p>
        </div>
      </header>

      {error && <div className="system-banner error">{error}</div>}

      <div className="history-list">
        {history.length === 0 && <div className="empty-state">아직 저장된 분석 기록이 없습니다.</div>}
        {history.map((item) => {
          const skillName = standards.find((standard) => standard.moveType === item.moveType)?.skillName || item.moveType;
          return (
            <article className="history-card" key={item.resultId}>
              <div className="history-score">{Math.round(item.totalScore || 0)}</div>
              <div className="history-main">
                <strong>{skillName}</strong>
                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '날짜 없음'}</span>
                <small>분석 신뢰도 {item.analysisConfidence ?? '-'}% · 착지 {item.landingStabilityScore ?? '-'}/100</small>
              </div>
              <div className="history-actions">
                <button onClick={() => onViewDetail(item)}>결과 보기</button>
                <button className="text-danger" onClick={() => deleteHistory(item.resultId)}>삭제</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default HistoryPortal;
