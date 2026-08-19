import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AnalysisEngine from './AnalysisEngine';
import AnalysisReport from './AnalysisReport';
import HistoryPortal from './HistoryPortal';
import KnowledgeManager from './KnowledgeManager';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const tabs = {
  analysis: { icon: '◎', label: '동작 분석', description: '영상을 촬영하거나 불러와 동작을 확인해요' },
  history: { icon: '◷', label: '분석 기록', description: '이전 결과를 다시 확인해요' },
  management: { icon: '◇', label: '기술 지식', description: '분석 기준과 코칭 지식을 관리해요' },
};

function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [standards, setStandards] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [bootstrapError, setBootstrapError] = useState('');

  const fetchInitialData = async () => {
    try {
      setBootstrapError('');
      const response = await axios.get(`${API_BASE_URL}/api/standards`);
      setStandards(response.data || []);
    } catch (error) {
      console.error('기술 정보를 불러오지 못했습니다.', error);
      setBootstrapError('분석 기준을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  useEffect(() => { fetchInitialData(); }, []);
  const selectTab = (tab) => { setActiveTab(tab); if (tab === 'analysis') setAnalysisData(null); };

  const renderContent = () => {
    if (activeTab === 'analysis') return analysisData
      ? <AnalysisReport data={analysisData} standards={standards} onReset={() => setAnalysisData(null)} />
      : <AnalysisEngine standards={standards} onAnalysisComplete={setAnalysisData} />;
    if (activeTab === 'history') return <HistoryPortal standards={standards} onViewDetail={(data) => { setAnalysisData(data); setActiveTab('analysis'); }} />;
    return <KnowledgeManager onDataChange={fetchInitialData} />;
  };

  return <div className="master-container">
    <aside className="side-dock">
      <div className="brand-block"><div className="brand-mark">A</div><div><strong>AITM</strong><span>AI 태권도 코치</span></div></div>
      <nav className="dock-nav" aria-label="주요 메뉴">
        {Object.entries(tabs).map(([key, tab]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => selectTab(key)} aria-current={activeTab === key ? 'page' : undefined}>
          <span className="nav-icon" aria-hidden="true">{tab.icon}</span><span><strong>{tab.label}</strong><small>{tab.description}</small></span>
        </button>)}
      </nav>
      <div className="privacy-note"><span>●</span><div><strong>영상은 안전하게 보관돼요</strong><small>원본 영상은 AI 외부 서비스로 전송하지 않습니다.</small></div></div>
    </aside>
    <main className="main-viewport">
      <header className="system-bar"><div><span className="eyebrow">AITM WORKSPACE</span><h1>{tabs[activeTab].label}</h1></div><div className="status-chip"><span /> 시스템 준비됨</div></header>
      {bootstrapError && <div className="global-alert" role="alert"><span>{bootstrapError}</span><button onClick={fetchInitialData}>다시 시도</button></div>}
      <section className="viewport-content">{renderContent()}</section>
    </main>
  </div>;
}
export default App;
