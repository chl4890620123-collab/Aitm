import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryPortal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
        <h1>Analysis History</h1>
        <p>과거 분석 세션 데이터를 관리합니다.</p>
      </div>
      
      <div className="portal-list">
        {history.length > 0 ? (
          <table className="history-table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Skill</th>
                <th>Timestamp / Source</th>
                <th>Actions</th>
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
                    <button onClick={() => onViewDetail(h)}>View Report</button>
                    <button className="del-btn" onClick={() => deleteHistory(h.resultId)}>Delete</button>
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
