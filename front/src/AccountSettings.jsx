import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function AccountSettings({ user, onWithdrawn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const withdraw = async (event) => {
    event.preventDefault();
    if (!window.confirm('탈퇴를 신청하면 즉시 분석 기능을 사용할 수 없습니다. 7일 내 철회할 수 있으며 이후 기록과 계정이 삭제됩니다. 신청하시겠습니까?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/withdraw`, { password });
      onWithdrawn(response.data.recoverUntil);
    } catch (e) {
      setError(e.response?.data?.message || '탈퇴 신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel account-card">
      <h2>내 계정</h2>
      <p>이메일: <strong>{user.email}</strong></p>
      <p>권한: {user.role === 'ADMIN' ? '관리자' : '일반 회원'}</p>
      <div className="account-withdrawal">
        <h3>계정 탈퇴</h3>
        <p className="helper-text">신청 즉시 로그아웃되고 분석할 수 없습니다. 7일 동안 탈퇴를 철회할 수 있으며, 기한이 지나면 계정과 저장된 분석 기록·영상이 삭제됩니다.</p>
        <form onSubmit={withdraw} className="auth-form">
          <label>탈퇴 신청을 위한 비밀번호 확인
            <input type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="account-delete" type="submit" disabled={busy}>{busy ? '처리 중...' : '계정 탈퇴 신청'}</button>
        </form>
      </div>
    </section>
  );
}