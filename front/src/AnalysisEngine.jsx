import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import './AnalysisEngine.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

  const sources = [
    ['camera', '카메라로 촬영', '지금 동작을 바로 녹화해요', '●'],
    ['file', '영상 파일 불러오기', '저장된 MP4·MOV·AVI·WEBM을 사용해요', '↑'],
    ['url', '영상 URL 입력', '허용된 직접 영상 주소를 사용해요', '↗'],
  ];
  return <div className="analysis-workspace">
    <div className="welcome-copy"><span className="section-kicker">3분이면 충분해요</span><h2>내 동작을 쉽고 정확하게 확인해 보세요</h2><p>아래 순서대로 선택하면 AI 코치가 자세를 분석하고 개선 포인트를 알려드려요.</p></div>
    <ol className="stepper" aria-label="분석 진행 단계">{['분석 설정', '영상 준비', '결과 만들기'].map((label, index) => <li key={label} className={`step-n ${step >= index + 1 ? 'on' : ''}`}><span>{step > index + 1 ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{index === 0 ? '기술과 영상 방식 선택' : index === 1 ? '촬영 또는 영상 확인' : 'AI 자세 분석'}</small></div></li>)}</ol>
    {step === 1 && <div className="config-grid-card"><div className="c-head"><span className="card-number">1</span><div><h3>무엇을 분석할까요?</h3><p>사용자와 태권도 기술을 선택해 주세요.</p></div></div><div className="c-body">
      <div className="form-grid"><div className="input-group-modern"><label htmlFor="userId">사용자 이름 <small>기록을 구분할 때 사용해요</small></label><input id="userId" value={formData.userId} onChange={(e) => setFormData({ ...formData, userId: e.target.value })} placeholder="예: 홍길동" /></div><div className="input-group-modern"><label htmlFor="moveType">분석할 기술 <small>수행한 동작을 골라 주세요</small></label><select id="moveType" value={formData.moveType} onChange={(e) => setFormData({ ...formData, moveType: e.target.value })}><option value="">기술 선택</option>{standards.map((s) => <option key={s.moveType} value={s.moveType}>{s.skillName}</option>)}</select></div></div>
      <fieldset className="source-field"><legend>영상은 어떻게 준비할까요?</legend><div className="source-grid">{sources.map(([type, title, description, icon]) => <button type="button" key={type} className={`source-item ${inputType === type ? 'on' : ''}`} onClick={() => setInputType(type)} aria-pressed={inputType === type}><span className="source-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><i>{inputType === type ? '✓' : ''}</i></button>)}</div></fieldset>
      <div className="tip-box"><strong>촬영 팁</strong><span>전신이 화면에 보이도록 카메라를 세우고, 밝은 곳에서 촬영하면 분석이 더 정확해져요.</span></div>
      <button className="exec-btn" onClick={() => setStep(2)} disabled={!formData.moveType}>영상 준비하기 <span>→</span></button>
    </div></div>}
    {step === 2 && <div className="media-shell"><div className="media-header"><button className="back-link" onClick={() => setStep(1)}>← 설정으로</button><div><h3>분석할 영상을 확인해 주세요</h3><p>동작이 잘 보이면 바로 분석을 시작할 수 있어요.</p></div></div>
      {inputType === 'camera' && <div className="webcam-box"><Webcam audio={false} ref={webcamRef} videoConstraints={{ facingMode:'user' }} /><div className="record-controls"><span className={recording ? 'record-status active' : 'record-status'}>{recording ? '● 녹화 중' : recordedBlob ? '✓ 녹화 완료' : '촬영 준비됨'}</span><button onClick={recording ? stopRecording : startRecording}>{recording ? '녹화 마치기' : recordedBlob ? '다시 촬영하기' : '촬영 시작'}</button></div></div>}
      {inputType === 'file' && <button type="button" className={`file-drop-zone ${selectedFile ? 'has-file' : ''}`} onClick={() => document.getElementById('fileInput').click()}><input id="fileInput" type="file" hidden accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" onChange={(e) => setSelectedFile(e.target.files[0])} /><span className="upload-icon">↑</span><strong>{selectedFile?.name || '여기를 눌러 영상 파일을 선택하세요'}</strong><small>{selectedFile ? '다른 파일로 바꾸려면 다시 눌러 주세요' : '최대 500MB · MP4, MOV, AVI, WEBM'}</small></button>}
      {inputType === 'url' && <div className="url-panel"><div className="input-group-modern"><label htmlFor="sourceUrl">영상 주소</label><input id="sourceUrl" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/video.mp4" /><small className="field-help">YouTube 주소는 재생 참고용이며 분석하려면 허가받은 원본 파일이 필요해요.</small></div>{youtubeId(sourceUrl) && <iframe title="YouTube 참고 영상" width="100%" height="360" src={`https://www.youtube.com/embed/${youtubeId(sourceUrl)}`} allowFullScreen />}</div>}
      {previewUrl && <div className="preview-panel"><video ref={videoRef} src={previewUrl} controls onLoadedMetadata={() => setRate(playbackRate)} /><div className="speed-controls"><span>느리게 확인</span><button onClick={() => stepFrame(-1)}>−1 프레임</button>{[0.25,0.5,1].map((rate) => <button className={playbackRate === rate ? 'active' : ''} key={rate} onClick={() => setRate(rate)}>{rate}×</button>)}<button onClick={() => stepFrame(1)}>+1 프레임</button></div></div>}
      <div className="shell-footer"><div><strong>분석 전 확인</strong><small>전신이 보이고 영상이 흔들리지 않나요?</small></div><button className="start-run-btn" onClick={startAnalysis}>AI 분석 시작 <span>→</span></button></div>
    </div>}
    {step === 3 && <div className="loading-stage" aria-live="polite"><div className="loader-orbit"><span /></div><div className="loading-text"><span className="section-kicker">AI가 동작을 살펴보고 있어요</span><h2>{loading ? '조금만 기다려 주세요' : '분석이 완료됐어요'}</h2><p>관절 위치를 찾고 기술 기준과 비교해 맞춤 코칭을 만드는 중입니다.</p></div><div className="loading-checks"><span>✓ 영상 안전하게 저장</span><span>✓ 자세 랜드마크 측정</span><span>● 근거 기반 코칭 생성</span></div></div>}
  </div>;
};

export default AnalysisEngine;
