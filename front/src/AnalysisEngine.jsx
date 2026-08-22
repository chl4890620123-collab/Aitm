import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import './AnalysisEngine.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_RECORD_SECONDS = 20;

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.detail || error?.message || '분석 중 오류가 발생했습니다.';
}

function inferExtension(url) {
  try {
    const path = new URL(url).pathname;
    return path.includes('.') ? path.split('.').pop().toLowerCase() : 'mp4';
  } catch {
    return 'mp4';
  }
}

function AnalysisEngine({ standards, onAnalysisComplete }) {
  const webcamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickerRef = useRef(null);
  const autoStopRef = useRef(null);

  const [sourceType, setSourceType] = useState('camera');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    userId: 'guest_user',
    moveType: '',
    mode: 'PRECISION',
    cameraDistance: 3,
    cameraHeight: 120,
  });

  useEffect(() => {
    if (!formData.moveType && standards.length > 0) {
      setFormData((prev) => ({ ...prev, moveType: standards[0].moveType }));
    }
  }, [standards, formData.moveType]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    clearInterval(tickerRef.current);
    clearTimeout(autoStopRef.current);
  }, [previewUrl]);

  const setFilePreview = (file) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const stopRecording = () => {
    clearInterval(tickerRef.current);
    clearTimeout(autoStopRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = () => {
    const stream = webcamRef.current?.video?.srcObject;
    if (!stream) {
      setError('카메라가 준비되지 않았습니다. 브라우저 카메라 권한을 확인하세요.');
      return;
    }

    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const extension = type.includes('mp4') ? 'mp4' : type.includes('quicktime') ? 'mov' : 'webm';
      const file = new File([blob], `aitm-camera-${Date.now()}.${extension}`, { type });
      setFilePreview(file);
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setRecordSeconds(0);
    setError('');

    tickerRef.current = setInterval(() => {
      setRecordSeconds((seconds) => Math.min(seconds + 1, MAX_RECORD_SECONDS));
    }, 1000);
    autoStopRef.current = setTimeout(stopRecording, MAX_RECORD_SECONDS * 1000);
  };

  const changeSource = (type) => {
    if (recording) stopRecording();
    setSourceType(type);
    setError('');
  };

  const runAnalysis = async () => {
    if (!formData.moveType) {
      setError('분석할 기술을 선택하세요.');
      return;
    }
    if ((sourceType === 'camera' || sourceType === 'file') && !selectedFile) {
      setError(sourceType === 'camera' ? '먼저 카메라로 동작을 촬영하세요.' : '분석할 영상 파일을 선택하세요.');
      return;
    }
    if (sourceType === 'url' && !remoteUrl.trim()) {
      setError('직접 영상 URL을 입력하세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let response;
      if (sourceType === 'url') {
        response = await axios.post(`${API_BASE_URL}/api/analysis/execute`, {
          ...formData,
          videoUrl: remoteUrl.trim(),
          playbackUrl: remoteUrl.trim(),
          sourceType: 'url',
          fileExtension: inferExtension(remoteUrl.trim()),
        });
      } else {
        const body = new FormData();
        body.append('file', selectedFile);
        body.append('userId', formData.userId || 'guest_user');
        body.append('moveType', formData.moveType);
        body.append('mode', formData.mode);
        body.append('sourceType', sourceType);
        body.append('cameraDistance', String(formData.cameraDistance || 3));
        body.append('cameraHeight', String(formData.cameraHeight || 120));
        response = await axios.post(`${API_BASE_URL}/api/analysis/upload`, body);
      }
      onAnalysisComplete(response.data);
    } catch (requestError) {
      console.error(requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const selectedSkill = standards.find((item) => item.moveType === formData.moveType);
  const cameraSecure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  return (
    <div className="analysis-page">
      <section className="intro-card">
        <div>
          <p className="section-kicker">영상 기반 실제 Pose 분석</p>
          <h2>촬영하고, 느리게 다시 보고, 부족한 구간을 확인하세요.</h2>
          <p>AITM은 영상에서 관절 좌표를 측정한 뒤 프로젝트 기준값과 비교합니다. LLM은 점수를 만들지 않고 코칭 설명만 담당합니다.</p>
        </div>
      </section>

      <div className="analysis-layout">
        <section className="panel settings-panel">
          <h3>1. 분석 설정</h3>
          <label>
            분석 기술
            <select value={formData.moveType} onChange={(e) => setFormData({ ...formData, moveType: e.target.value })}>
              {standards.map((item) => <option key={item.moveType} value={item.moveType}>{item.skillName}</option>)}
            </select>
          </label>

          <div className="compact-grid">
            <label>
              촬영 거리(m)
              <input type="number" min="1" max="8" step="0.5" value={formData.cameraDistance} onChange={(e) => setFormData({ ...formData, cameraDistance: Number(e.target.value) })} />
            </label>
            <label>
              카메라 높이(cm)
              <input type="number" min="50" max="200" step="5" value={formData.cameraHeight} onChange={(e) => setFormData({ ...formData, cameraHeight: Number(e.target.value) })} />
            </label>
          </div>

          {selectedSkill && <p className="helper-text">{selectedSkill.description}</p>}

          <h3>2. 영상 입력</h3>
          <div className="source-tabs">
            <button className={sourceType === 'camera' ? 'active' : ''} onClick={() => changeSource('camera')}>카메라</button>
            <button className={sourceType === 'file' ? 'active' : ''} onClick={() => changeSource('file')}>파일</button>
            <button className={sourceType === 'url' ? 'active' : ''} onClick={() => changeSource('url')}>URL</button>
          </div>

          <div className="capture-tip">
            <strong>촬영 팁</strong>
            <span>전신이 화면 안에 들어오고, 발이 잘리지 않도록 약 3m 거리에서 촬영하세요.</span>
          </div>
        </section>

        <section className="panel capture-panel">
          {sourceType === 'camera' && (
            <>
              {!cameraSecure && <div className="inline-error">카메라 촬영은 HTTPS 또는 localhost 환경이 필요합니다.</div>}
              {!previewUrl && (
                <div className="camera-frame">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={false}
                    videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
                  />
                  {recording && <div className="record-badge">REC {recordSeconds}s / {MAX_RECORD_SECONDS}s</div>}
                </div>
              )}
              {previewUrl && <video className="preview-video" src={previewUrl} controls playsInline />}
              <div className="capture-actions">
                {!recording && !previewUrl && <button className="primary" onClick={startRecording}>촬영 시작</button>}
                {recording && <button className="danger" onClick={stopRecording}>촬영 종료</button>}
                {previewUrl && <button onClick={() => { setSelectedFile(null); setPreviewUrl(''); }}>다시 촬영</button>}
              </div>
            </>
          )}

          {sourceType === 'file' && (
            <div className="file-input-area">
              <input id="video-file" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(e) => setFilePreview(e.target.files?.[0])} />
              <label htmlFor="video-file" className="file-picker">영상 파일 선택</label>
              {selectedFile && <p>{selectedFile.name}</p>}
              {previewUrl && <video className="preview-video" src={previewUrl} controls playsInline />}
            </div>
          )}

          {sourceType === 'url' && (
            <div className="url-area">
              <label>
                직접 영상 URL
                <input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} placeholder="https://.../video.mp4" />
              </label>
              <p className="helper-text">보안을 위해 서버의 허용 호스트 목록에 등록된 직접 영상 URL만 분석합니다.</p>
            </div>
          )}

          {error && <div className="inline-error">{error}</div>}

          <button className="analyze-button" onClick={runAnalysis} disabled={loading || recording}>
            {loading ? 'Pose 분석 중...' : '저장하고 평가하기'}
          </button>
        </section>
      </div>

      {loading && (
        <div className="loading-overlay" role="status">
          <div className="spinner" />
          <strong>영상에서 관절 좌표를 측정하고 있습니다.</strong>
          <span>촬영 길이에 따라 프레임 분석 시간이 달라질 수 있습니다.</span>
        </div>
      )}
    </div>
  );
}

export default AnalysisEngine;
