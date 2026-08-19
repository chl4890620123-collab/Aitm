import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryPortal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const HistoryPortal = ({ standards, onViewDetail }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/analysis/history`);
      // 최신 로그 우선 정렬
      setHistory(res.data.reverse());
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistory = async (id) => {
    if (!id || !window.confirm("기록을 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/analysis/delete/${id}`);
      fetchHistory(); 
    } catch (e) {
      alert("Delete failed");
    }
  };

  if (loading) return <div className="portal-loading">Loading History...</div>;

  return (
    <div className="history-portal">
      <div className="portal-header">
        <span className="section-kicker">나의 성장 기록</span><h1>분석 기록</h1>
        <p>이전 동작의 점수와 코칭을 다시 확인할 수 있어요.</p>
      </div>
      
      <div className="portal-list">
        {history.length > 0 ? (
          <table className="history-table">
            <thead>
              <tr>
                <th>점수</th><th>기술</th><th>분석 영상</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.resultId}>
                  <td className="h-score">{Math.round(h.totalScore || 0)}</td>
                  <td className="h-skill">
                    {standards.find(s => s.moveType === h.moveType)?.skillName || h.moveType}
                  </td>
                  <td className="h-info">
                    {new Date().toLocaleDateString()} / {h.videoUrl?.split('/').pop().substring(0, 30)}
                  </td>
                  <td className="h-actions">
                    <button onClick={() => onViewDetail(h)}>결과 보기</button>
                    <button className="del-btn" onClick={() => deleteHistory(h.resultId)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data-msg">
            <p>분석 데이터가 존재하지 않습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPortal;
