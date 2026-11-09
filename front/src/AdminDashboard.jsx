import { useEffect, useState } from 'react';
import axios from 'axios';
import KnowledgeManager from './KnowledgeManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function AdminDashboard({ onStandardsChanged }) {
  const [tab, setTab] = useState('members');
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/api/admin/users`),
      axios.get(`${API_BASE_URL}/api/admin/summary`),
    ]).then(([members, stats]) => {
      setUsers(members.data);
      setSummary(stats.data);
    }).catch(e => setError(e.response?.data?.message || '관리자 정보를 불러오지 못했습니다.'));
  }, []);

  return (
    <div className="admin-page">
      <header className="simple-page-header"><h2>관리자 페이지</h2><p>회원 현황과 기술 평가 기준을 구분해서 관리합니다.</p></header>
      <div className="admin-tabs">
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>회원 현황</button>
        <button className={tab === 'standards' ? 'active' : ''} onClick={() => setTab('standards')}>평가 기준 관리</button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {tab === 'members' ? (
        <section className="panel admin-members">
          {summary && <p><strong>전체 {summary.totalUsers}명</strong> · 이용 중 {summary.activeUsers}명 · 탈퇴 대기 {summary.pendingDeletion}명</p>}
          {users.map(u => (
            <div className="member-row" key={u.id}>
              <div><strong>{u.email}</strong><small>{u.role === 'ADMIN' ? '관리자' : '일반 회원'} · {u.status === 'ACTIVE' ? '이용 중' : '탈퇴 대기'}</small></div>
              {u.recoverUntil && <span className="helper-text">철회 기한: {new Date(u.recoverUntil).toLocaleString('ko-KR')}</span>}
            </div>
          ))}
        </section>
      ) : <KnowledgeManager onDataChange={onStandardsChanged} />}
    </div>
  );
}