import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import './AnalysisEngine.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const youtubeId = (url) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/);
  return match?.[1] || null;
};

const AnalysisEngine = ({ standards, onAnalysisComplete }) => {
  const [step, setStep] = useState(1);
  const [inputType, setInputType] = useState('camera');
  const [selectedFile, setSelectedFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [playbackRate, setPlaybackRate] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ userId: 'Master User', moveType: '', mode: 'PRECISION' });
  const webcamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!formData.moveType && standards[0]?.moveType) {
      setFormData((current) => ({ ...current, moveType: standards[0].moveType }));
    }
  }, [standards, formData.moveType]);

  const startRecording = () => {
    const stream = webcamRef.current?.stream;
    if (!stream) return alert('카메라를 사용할 수 없습니다.');
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
    recorder.onstop = () => setRecordedBlob(new Blob(chunksRef.current, { type: 'video/webm' }));
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const uploadVideo = async (file) => {
    const body = new FormData();
    body.append('file', file);
    const response = await axios.post(`${API_BASE_URL}/api/videos/upload`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  };

  const startAnalysis = async () => {
    if (!formData.moveType) return alert('분석 기술을 선택해 주세요.');
    if (inputType === 'url' && youtubeId(sourceUrl)) return alert('YouTube 영상은 참조 재생 전용입니다. 허가받은 원본 파일을 업로드해 분석해 주세요.');
    setLoading(true);
    setStep(3);
    try {
      let source;
      if (inputType === 'camera') {
        if (!recordedBlob) throw new Error('카메라 영상을 먼저 녹화해 주세요.');
        source = await uploadVideo(new File([recordedBlob], `camera-${Date.now()}.webm`, { type: 'video/webm' }));
      } else if (inputType === 'file') {
        if (!selectedFile) throw new Error('분석할 영상 파일을 선택해 주세요.');
        source = await uploadVideo(selectedFile);
      } else {
        if (!sourceUrl.startsWith('https://') && !sourceUrl.startsWith('http://')) throw new Error('올바른 영상 URL을 입력해 주세요.');
        const extension = sourceUrl.split('?')[0].split('.').pop().toLowerCase();
        source = { videoUrl: sourceUrl, fileSize: null, fileExtension: extension };
      }
      const response = await axios.post(`${API_BASE_URL}/api/analysis/execute`, { ...formData, ...source });
      onAnalysisComplete({ ...response.data, playbackUrl: source.playbackUrl || sourceUrl });
    } catch (error) {
      alert(error.response?.data?.message || error.message || '분석에 실패했습니다.');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = recordedBlob ? URL.createObjectURL(recordedBlob) : selectedFile ? URL.createObjectURL(selectedFile) : '';
  const setRate = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };
  const stepFrame = (direction) => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + direction / 30);
  };

  return <div className="analysis-workspace">
    <div className="stepper">{[1, 2, 3].map((n) => <div key={n} className={`step-n ${step >= n ? 'on' : ''}`}>STEP {n}</div>)}</div>
    {step === 1 && <div className="setup-view"><div className="config-grid-card"><div className="c-head"><h2>Engine Config</h2><p>분석 기술과 영상 소스를 선택하십시오.</p></div><div className="c-body">
      <div className="input-group-modern"><label>User ID</label><input value={formData.userId} onChange={(e) => setFormData({ ...formData, userId: e.target.value })} /></div>
      <div className="input-row-modern"><div className="input-group-modern flex-2"><label>Target Skill</label><select value={formData.moveType} onChange={(e) => setFormData({ ...formData, moveType: e.target.value })}>{standards.map((s) => <option key={s.moveType} value={s.moveType}>{s.skillName}</option>)}</select></div></div>
      <div className="source-grid">{[['camera', 'Camera Record'], ['file', 'Video File'], ['url', 'Video URL']].map(([type, label]) => <div key={type} className={`source-item ${inputType === type ? 'on' : ''}`} onClick={() => setInputType(type)}>{label}</div>)}</div>
      <button className="exec-btn" onClick={() => setStep(2)}>Next Step</button>
    </div></div></div>}
    {step === 2 && <div className="input-view"><div className="media-shell">
      {inputType === 'camera' && <div className="webcam-box"><Webcam audio={false} ref={webcamRef} /><div><button onClick={recording ? stopRecording : startRecording}>{recording ? 'Stop Recording' : 'Start Recording'}</button></div></div>}
      {inputType === 'file' && <div className="file-drop-zone" onClick={() => document.getElementById('fileInput').click()}><input id="fileInput" type="file" hidden accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" onChange={(e) => setSelectedFile(e.target.files[0])} /><strong>{selectedFile?.name || 'Click to Upload Video'}</strong></div>}
      {inputType === 'url' && <div className="input-group-modern"><label>직접 영상 URL 또는 YouTube 참조 URL</label><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />{youtubeId(sourceUrl) && <iframe title="YouTube reference" width="100%" height="360" src={`https://www.youtube.com/embed/${youtubeId(sourceUrl)}`} allowFullScreen />}</div>}
      {previewUrl && <div><video ref={videoRef} src={previewUrl} controls width="100%" onLoadedMetadata={() => setRate(playbackRate)} /><div><button onClick={() => stepFrame(-1)}>◀ 1 frame</button>{[0.25, 0.5, 1].map((rate) => <button key={rate} onClick={() => setRate(rate)}>{rate}×</button>)}<button onClick={() => stepFrame(1)}>1 frame ▶</button></div></div>}
      <div className="shell-footer"><button className="back-link" onClick={() => setStep(1)}>Back</button><button className="start-run-btn" onClick={startAnalysis}>Run Analysis</button></div>
    </div></div>}
    {step === 3 && <div className="loading-stage"><div className="loading-text"><h2>Processing Pose Inference...</h2><p>{loading ? '영상에서 관절 좌표를 추출하고 근거 기반 코칭을 생성합니다.' : '완료'}</p></div></div>}
  </div>;
};

export default AnalysisEngine;
