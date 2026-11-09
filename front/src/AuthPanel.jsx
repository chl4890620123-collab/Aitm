import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'login') {
        const form = new URLSearchParams({ username: email.trim(), password });
        await axios.post(`${API_BASE_URL}/api/auth/login`, form);
        // Spring rotates the CSRF token on successful authentication.
        await axios.get(`${API_BASE_URL}/api/auth/csrf`);
        await onAuthenticated();
      } else if (mode === 'register') {
        await axios.post(`${API_BASE_URL}/api/auth/register`, { email, password });
        setPassword('');
        setMode('login');
        setNotice('회원가입이 완료되었습니다. 로그인하세요.');
      } else {
        await axios.post(`${API_BASE_URL}/api/auth/restore`, { email, password });
        setMode('login');
        setPassword('');
        setNotice('탈퇴 철회가 완료되었습니다. 로그인하세요.');
      }
    } catch (e) {
      setError(e.response?.data?.message || '요청을 완료하지 못했습니다. 입력 내용을 확인하세요.');
    } finally {
      setBusy(false);
    }
  };

  const setView = (next) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
  };

  return (
    <main className="auth-layout">
      <section className="panel auth-card">
        <p className="section-kicker">AI TAEKWONDO MASTER</p>
        <h1>{mode === 'login' ? 'AITM 로그인' : mode === 'register' ? '회원가입' : '탈퇴 철회'}</h1>
        <p className="helper-text">동작 분석 결과와 이전 기록을 본인 계정에서 관리하세요.</p>
        <form onSubmit={submit} className="auth-form">
          <label>이메일
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label>비밀번호
            <input type="password" minLength={mode === 'register' ? 10 : undefined} required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {mode === 'register' && <p className="helper-text">비밀번호는 10자 이상으로 설정하세요.</p>}
          {mode === 'restore' && <p className="helper-text">탈퇴 신청일로부터 7일 이내라면 이메일과 비밀번호로 철회할 수 있습니다.</p>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '탈퇴 철회'}
          </button>
        </form>
        <div className="auth-links">
          {mode !== 'login' && <button type="button" onClick={() => setView('login')}>로그인으로</button>}
          {mode !== 'register' && <button type="button" onClick={() => setView('register')}>회원가입</button>}
          {mode !== 'restore' && <button type="button" onClick={() => setView('restore')}>탈퇴 철회</button>}
        </div>
      </section>
    </main>
  );
}