import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AnalysisEngine from './AnalysisEngine';
import AnalysisReport from './AnalysisReport';
import HistoryPortal from './HistoryPortal';
import KnowledgeManager from './KnowledgeManager';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function App() {
  const [activeTab, setActiveTab] = useState('analysis'); 
  const [standards, setStandards] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);

  // 초기 런타임 데이터 로드
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/standards`);
      if (res.data) setStandards(res.data);
    } catch (e) { 
      console.error("Critical: Bootstrap Data Load Failed", e); 
    }
  };

  const handleAnalysisComplete = (data) => setAnalysisData(data);
  const resetAnalysis = () => setAnalysisData(null);

  // 탭 기반 동적 컨텐츠 렌더링
  const renderContent = () => {
    switch(activeTab) {
      case 'analysis':
        return analysisData ? (
          <AnalysisReport data={analysisData} standards={standards} onReset={resetAnalysis} />
        ) : (
          <AnalysisEngine standards={standards} onAnalysisComplete={handleAnalysisComplete} />
        );
      case 'history':
        return (
          <HistoryPortal 
            standards={standards} 
            onViewDetail={(data) => {
              setAnalysisData(data);
              setActiveTab('analysis');
            }} 
          />
        );
      case 'management':
        return <KnowledgeManager onDataChange={fetchInitialData} />;
      default:
        return null;
    }
  };

  return (
    <div className="master-container">
      {/* Side Navigation Control */}
      <aside className="side-dock">
        <div className="dock-logo">AITM SYSTEM</div>
        <nav className="dock-nav">
          <button 
            className={activeTab === 'analysis' ? 'active' : ''} 
            onClick={() => {setActiveTab('analysis'); resetAnalysis();}}
          >
            <span>Analysis Engine</span>
          </button>
          <button 
            className={activeTab === 'history' ? 'active' : ''} 
            onClick={() => setActiveTab('history')}
          >
            <span>Analytics History</span>
          </button>
          <button 
            className={activeTab === 'management' ? 'active' : ''} 
            onClick={() => setActiveTab('management')}
          >
            <span>Knowledge Lib</span>
          </button>
        </nav>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        <header className="system-bar">
          <div className="sys-path">PATH: {activeTab.toUpperCase()}</div>
        </header>

        <section className="viewport-content">
          {renderContent()}
        </section>
      </main>
    </div>
  );
}

export default App;
