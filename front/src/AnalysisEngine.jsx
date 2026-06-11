import React, { useState, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import './AnalysisEngine.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const AnalysisEngine = ({ standards, onAnalysisComplete }) => {
  const [step, setStep] = useState(1);
  const [inputType, setInputType] = useState('camera');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const webcamRef = useRef(null);

  // 분석 타겟 및 모드 상태 관리
  const [formData, setFormData] = useState({ 
    userId: "Master User", 
    moveType: standards[0]?.moveType || "", 
    mode: "PRECISION" 
  });

  // 분석 실행: 소스 타입(Stream/File)에 따른 페이로드 분기 처리
  const startAnalysis = async () => {
    if (inputType === 'file' && !selectedFile) return alert("분석 대상 파일을 업로드하십시오.");
    
    setLoading(true); 
    setStep(3);
    
    try {
      const AI_ENGINE_URL = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';
      const payload = {
        ...formData,
        videoUrl: inputType === 'file' ? `uploaded://${selectedFile?.name}` : `${AI_ENGINE_URL}/live.mp4`,
        fileSize: selectedFile ? selectedFile.size : 1024 * 1024 * 10,
        fileExtension: "mp4"
      };
      
      const res = await axios.post(`${API_BASE_URL}/api/analysis/execute`, payload);
      onAnalysisComplete(res.data);
    } catch (e) {
      alert("Analysis Engine Error");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-workspace">
      {/* 1. Workflow Progress */}
      <div className="stepper">
        {[1, 2, 3].map(n => (
          <div key={n} className={`step-n ${step >= n ? 'on' : ''}`}>
            STEP {n}
          </div>
        ))}
      </div>

      {/* 2. Setup Phase: Metadata & Logic Config */}
      {step === 1 && (
        <div className="setup-view">
          <div className="config-grid-card">
            <div className="c-head">
              <h2>Engine Config</h2>
              <p>동작 분석을 위한 타겟 기술 및 알고리즘 모드를 설정하십시오.</p>
            </div>
            <div className="c-body">
              <div className="input-group-modern">
                <label>User ID</label>
                <input 
                  value={formData.userId} 
                  onChange={e => setFormData({ ...formData, userId: e.target.value })} 
                />
              </div>
              <div className="input-row-modern">
                <div className="input-group-modern flex-2">
                  <label>Target Skill</label>
                  <select 
                    value={formData.moveType} 
                    onChange={e => setFormData({ ...formData, moveType: e.target.value })}
                  >
                    {standards.map(s => (
                      <option key={s.moveType} value={s.moveType}>{s.skillName}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group-modern flex-1">
                  <label>Analysis Mode</label>
                  <div className="toggle-pill">
                    <button 
                      className={formData.mode === 'PRECISION' ? 'on' : ''} 
                      onClick={() => setFormData({ ...formData, mode: 'PRECISION' })}
                    >
                      정밀
                    </button>
                    <button 
                      className={formData.mode === 'SPEED' ? 'on' : ''} 
                      onClick={() => setFormData({ ...formData, mode: 'SPEED' })}
                    >
                      고속
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="source-grid">
                <div 
                  className={`source-item ${inputType === 'camera' ? 'on' : ''}`} 
                  onClick={() => setInputType('camera')}
                >
                  Live Camera
                </div>
                <div 
                  className={`source-item ${inputType === 'file' ? 'on' : ''}`} 
                  onClick={() => setInputType('file')}
                >
                  Video File
                </div>
              </div>
              
              <button className="exec-btn" onClick={() => setStep(2)}>Next Step</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Input Phase: Source Capture */}
      {step === 2 && (
        <div className="input-view">
          <div className="media-shell">
            {inputType === 'camera' ? (
              <div className="webcam-box">
                <Webcam audio={false} ref={webcamRef} />
              </div>
            ) : (
              <div 
                className={`file-drop-zone ${selectedFile ? 'has-file' : ''}`} 
                onClick={() => document.getElementById('fileInput').click()}
              >
                <input 
                  id="fileInput" 
                  type="file" 
                  hidden 
                  onChange={e => setSelectedFile(e.target.files[0])} 
                  accept="video/*" 
                />
                <div className="drop-content">
                   <div className="drop-text">
                     {selectedFile ? (
                       <strong>{selectedFile.name}</strong>
                     ) : (
                       <span>Click to Upload Video</span>
                     )}
                   </div>
                </div>
              </div>
            )}
            <div className="shell-footer">
              <button className="back-link" onClick={() => setStep(1)}>Back</button>
              <button className="start-run-btn" onClick={startAnalysis}>Run Analysis</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Processing Phase: Backend & AI Inference */}
      {step === 3 && (
        <div className="loading-stage">
          <div className="loading-text">
            <h2>Processing Inference...</h2>
            <p>AI 엔진에서 동작 데이터를 추출하고 있습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisEngine;
