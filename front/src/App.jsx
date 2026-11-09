import { lazy, Suspense, useEffect, useState } from 'react';
import axios from 'axios';
const AnalysisEngine = lazy(() => import('./AnalysisEngine'));
const AnalysisReport = lazy(() => import('./AnalysisReport'));
const HistoryPortal = lazy(() => import('./HistoryPortal'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
import AuthPanel from './AuthPanel';
const AccountSettings = lazy(() => import('./AccountSettings'));
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
axios.defaults.withCredentials = true;
axios.defaults.withXSRFToken = true;

function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [standards, setStandards] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [bootstrapError, setBootstrapError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const fetchStandards = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/standards`);
      setStandards(response.data || []);
      setBootstrapError('');
    } catch {
      setBootstrapError('분석 기술 목록을 불러오지 못했습니다. 연결 상태를 확인하세요.');
    }
  };

  const refreshAccount = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
    setUser(response.data);
    setNotice('');
    setAnalysisData(null);
    setActiveTab('analysis');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/auth/csrf`);
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
        if (!cancelled) setUser(response.data);
      } catch (error) {
        if (!cancelled && error.response?.status !== 401) {
          setBootstrapError('로그인 상태를 확인할 수 없습니다. 다시 시도하세요.');
        }
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user) fetchStandards();
  }, [user?.id]);

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
      setUser(null);
      setAnalysisData(null);
      setActiveTab('analysis');
      setStandards([]);
      await axios.get(`${API_BASE_URL}/api/auth/csrf`);
    } catch {
      setBootstrapError('로그아웃에 실패했습니다. 다시 시도하세요.');
    }
  };

  const withdrawComplete = async (recoverUntil) => {
    setNotice(`탈퇴가 신청되었습니다. ${new Date(recoverUntil).toLocaleString('ko-KR')} 전까지 철회할 수 있습니다.`);
    setUser(null);
    setAnalysisData(null);
    setStandards([]);
    await axios.get(`${API_BASE_URL}/api/auth/csrf`).catch(() => {});
  };

  const openReport = (data) => {
    setAnalysisData(data);
    setActiveTab('analysis');
  };

  if (checkingAuth) return <div className="center-state">로그인 상태를 확인하고 있습니다...</div>;

  if (!user) {
    return (
      <div className="app-shell">
        {notice && <p className="system-banner">{notice}</p>}
        {bootstrapError && <p className="system-banner error">{bootstrapError}</p>}
        <AuthPanel onAuthenticated={refreshAccount} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI TAEKWONDO MASTER</p>
          <h1>AITM</h1>
        </div>
        <nav className="topnav" aria-label="주요 메뉴">
          <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>자세 분석</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>내 기록</button>
          {user.role === 'ADMIN' && <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>관리자</button>}
          <button className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}>내 계정</button>
          <button onClick={logout}>로그아웃</button>
        </nav>
      </header>

      {bootstrapError && <p className="system-banner error">{bootstrapError}</p>}

      <main className="page-container">
        <Suspense fallback={<div className="center-state">필요한 화면을 불러오는 중...</div>}>
        {activeTab === 'analysis' && (
          analysisData ? (
            <AnalysisReport data={analysisData} standards={standards} onReset={() => setAnalysisData(null)} />
          ) : (
            <AnalysisEngine standards={standards} onAnalysisComplete={setAnalysisData} />
          )
        )}
        {activeTab === 'history' && <HistoryPortal standards={standards} onViewDetail={openReport} />}
        {activeTab === 'account' && <AccountSettings user={user} onWithdrawn={withdrawComplete} />}
        {activeTab === 'admin' && user.role === 'ADMIN' && (
          <AdminDashboard onStandardsChanged={fetchStandards} />
        )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
