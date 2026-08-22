import { useEffect, useState } from 'react';
import axios from 'axios';
import AnalysisEngine from './AnalysisEngine';
import AnalysisReport from './AnalysisReport';
import HistoryPortal from './HistoryPortal';
import KnowledgeManager from './KnowledgeManager';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [standards, setStandards] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [bootstrapError, setBootstrapError] = useState('');

  const fetchStandards = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/standards`);
      setStandards(response.data || []);
      setBootstrapError('');
    } catch (error) {
      console.error(error);
      setBootstrapError('백엔드와 연결되지 않았습니다. Docker 또는 Spring 서버 상태를 확인하세요.');
    }
  };

  useEffect(() => {
    fetchStandards();
  }, []);

  const openReport = (data) => {
    setAnalysisData(data);
    setActiveTab('analysis');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI TAEKWONDO MASTER</p>
          <h1>AITM</h1>
        </div>
        <nav className="topnav" aria-label="주요 메뉴">
          <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>분석</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>기록</button>
          <button className={activeTab === 'management' ? 'active' : ''} onClick={() => setActiveTab('management')}>기준 관리</button>
        </nav>
      </header>

      {bootstrapError && <div className="system-banner error">{bootstrapError}</div>}

      <main className="page-container">
        {activeTab === 'analysis' && (
          analysisData ? (
            <AnalysisReport
              data={analysisData}
              standards={standards}
              onReset={() => setAnalysisData(null)}
            />
          ) : (
            <AnalysisEngine standards={standards} onAnalysisComplete={setAnalysisData} />
          )
        )}

        {activeTab === 'history' && (
          <HistoryPortal standards={standards} onViewDetail={openReport} />
        )}

        {activeTab === 'management' && (
          <KnowledgeManager onDataChange={fetchStandards} />
        )}
      </main>
    </div>
  );
}

export default App;
