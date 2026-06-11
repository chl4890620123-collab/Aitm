import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './KnowledgeManager.css';

/**
 * 기술 지식 및 표준 관리 컴포넌트
 * 새로운 기술을 등록하거나 기존 기술의 채점 기준을 수정할 수 있는 관리자 화면입니다.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const KnowledgeManager = ({ onDataChange }) => {
  // 기술 표준 목록
  const [standards, setStandards] = useState([]);
  // AI 지식(채점 기준) 목록
  const [knowledgeList, setKnowledgeList] = useState([]);
  // 검색어
  const [searchQuery, setSearchQuery] = useState("");
  // 선택된 수정 아이템
  const [selectedItem, setSelectedItem] = useState(null);

  // 신규 기술 등록 폼 데이터
  const [newSkill, setNewSkill] = useState({
    moveType: "", skillName: "", description: "", referenceVideoUrl: "",
    technicalPoint: "회전 속도", criteriaValue: 150, coachingMessage: ""
  });

  /**
   * 컴포넌트 마운트 시 데이터 로드
   */
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * 백엔드에서 기술 표준 및 지식 데이터를 모두 가져옵니다.
   */
  const fetchData = async () => {
    try {
      const [stdRes, knwRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/standards`),
        axios.get(`${API_BASE_URL}/api/knowledge`)
      ]);
      setStandards(stdRes.data);
      setKnowledgeList(knwRes.data);
      if (onDataChange) onDataChange();
    } catch (e) { 
      console.error("데이터 동기화 실패:", e); 
    }
  };

  /**
   * 기술과 채점 기준을 동시에 등록합니다.
   */
  const saveUnifiedSkill = async () => {
    if(!newSkill.skillName || !newSkill.moveType) return alert("기술 명칭과 영문 코드를 입력해주십시오.");
    try {
      // 1. 기술 기본 정보(Standard) 등록
      await axios.post(`${API_BASE_URL}/api/standards`, {
        moveType: newSkill.moveType,
        skillName: newSkill.skillName,
        description: newSkill.description,
        referenceVideoUrl: newSkill.referenceVideoUrl,
        standardData: JSON.stringify({ idealValue: newSkill.criteriaValue })
      });
      
      // 2. AI 채점 로직(Knowledge) 등록
      await axios.post(`${API_BASE_URL}/api/knowledge`, {
        technicalPoint: `${newSkill.skillName} - ${newSkill.technicalPoint}`,
        criteriaValue: newSkill.criteriaValue,
        coachingMessage: newSkill.coachingMessage || `${newSkill.skillName} 분석 결과, ${newSkill.technicalPoint}가 기준에 미달합니다.`
      });

      alert("기술 정보가 등록되었습니다.");
      // 폼 초기화
      setNewSkill({ moveType: "", skillName: "", description: "", referenceVideoUrl: "", technicalPoint: "회전 속도", criteriaValue: 150, coachingMessage: "" });
      fetchData();
    } catch (e) { 
      alert("데이터 저장 중 오류가 발생했습니다."); 
    }
  };

  /**
   * 데이터 삭제 처리
   */
  const deleteItem = async (type, id) => {
    if(!window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      const url = type === 'standard' ? `/api/standards/${id}` : `/api/knowledge/${id}`;
      await axios.delete(`${API_BASE_URL}${url}`);
      fetchData();
      setSelectedItem(null);
    } catch (e) { 
      alert("삭제 처리에 실패했습니다."); 
    }
  };

  /**
   * 데이터 수정 처리
   */
  const updateItem = async () => {
    if (!selectedItem) return;
    try {
      let dataToSend = { ...selectedItem };
      
      if (selectedItem.type === 'standard') {
        const updatedData = {
          technicalPoint: selectedItem.technicalPoint,
          idealValue: selectedItem.criteriaValue
        };
        dataToSend.standardData = JSON.stringify(updatedData);
      }

      const url = selectedItem.type === 'standard' 
        ? `${API_BASE_URL}/api/standards/${selectedItem.id}` 
        : `${API_BASE_URL}/api/knowledge/${selectedItem.id}`;
      
      await axios.put(url, dataToSend);
      alert("수정되었습니다.");
      setSelectedItem(null);
      fetchData();
    } catch (e) {
      alert("수정 처리에 실패했습니다.");
    }
  };

  /**
   * 수정 모달 열기
   */
  const openEditModal = (item, type) => {
    let baseItem = { ...item, type };
    if (type === 'standard' && item.standardData) {
      try {
        const parsed = JSON.parse(item.standardData);
        baseItem.technicalPoint = parsed.technicalPoint || "평가 지표";
        baseItem.criteriaValue = parsed.idealValue || 0;
      } catch (e) {
        baseItem.technicalPoint = "평가 지표";
        baseItem.criteriaValue = 0;
      }
    }
    setSelectedItem(baseItem);
  };

  return (
    <div className="km-container">
      <header className="km-header">
        <h1>기술 라이브러리 관리</h1>
        <p>시스템에 등록된 태권도 기술 표준과 AI 채점 기준을 관리합니다.</p>
      </header>

      <div className="km-main-grid">
        {/* 신규 기술 등록 폼 */}
        <section className="km-form-section">
          <div className="admin-form-box">
            <h3>신규 기술 등록</h3>
            <div className="form-item">
              <label>기술 명칭</label>
              <input value={newSkill.skillName} onChange={e => setNewSkill({...newSkill, skillName: e.target.value})} placeholder="예: 돌개차기" />
            </div>
            <div className="form-item">
              <label>기술 코드 (영문)</label>
              <input value={newSkill.moveType} onChange={e => setNewSkill({...newSkill, moveType: e.target.value})} placeholder="예: dolgechigi" />
            </div>
            <div className="form-item">
              <label>평가 항목 및 기준점수</label>
              <div className="input-row">
                <input value={newSkill.technicalPoint} onChange={e => setNewSkill({...newSkill, technicalPoint: e.target.value})} placeholder="항목명" />
                <input type="number" value={newSkill.criteriaValue} onChange={e => setNewSkill({...newSkill, criteriaValue: parseFloat(e.target.value) || 0})} placeholder="기준점" />
              </div>
            </div>
            <div className="form-item">
              <label>마스터 코칭 메시지</label>
              <textarea value={newSkill.coachingMessage} onChange={e => setNewSkill({...newSkill, coachingMessage: e.target.value})} placeholder="기준 미달 시 출력될 조언을 입력하세요." />
            </div>
            <button className="submit-btn" onClick={saveUnifiedSkill}>기술 정보 저장</button>
          </div>
        </section>

        {/* 목록 조회 섹션 */}
        <section className="km-list-section">
          <div className="list-search">
            <input placeholder="기술 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          
          <div className="list-box">
             <h4>등록된 기술 ({standards.length})</h4>
             <div className="item-list">
                {standards.filter(s => s.skillName.includes(searchQuery)).map(s => (
                  <div key={s.moveType} className="list-entry" onClick={() => openEditModal(s, 'standard')}>
                    <strong>{s.skillName}</strong> <span>({s.moveType})</span>
                  </div>
                ))}
             </div>

             <h4>채점 로직 ({knowledgeList.length})</h4>
             <div className="item-list">
                {knowledgeList.filter(k => k.technicalPoint.includes(searchQuery)).map(k => (
                  <div key={k.id} className="list-entry" onClick={() => openEditModal(k, 'knowledge')}>
                    <strong>{k.technicalPoint}</strong> <span>(기준: {k.criteriaValue})</span>
                  </div>
                ))}
             </div>
          </div>
        </section>
      </div>

      {/* 수정 모달 */}
      {selectedItem && (
        <div className="modal-overlay">
          <div className="modal-window">
             <div className="modal-head">
                <h3>정보 수정</h3>
                <button onClick={() => setSelectedItem(null)}>닫기</button>
             </div>
             <div className="modal-body">
                <div className="form-item">
                  <label>항목/명칭</label>
                  <input value={selectedItem.skillName || selectedItem.technicalPoint} onChange={e => {
                    if(selectedItem.type === 'standard') setSelectedItem({...selectedItem, skillName: e.target.value});
                    else setSelectedItem({...selectedItem, technicalPoint: e.target.value});
                  }} />
                </div>
                <div className="form-item">
                  <label>기준치/설명</label>
                  <textarea value={selectedItem.description || selectedItem.coachingMessage} onChange={e => {
                    if(selectedItem.type === 'standard') setSelectedItem({...selectedItem, description: e.target.value});
                    else setSelectedItem({...selectedItem, coachingMessage: e.target.value});
                  }} />
                </div>
                <div className="modal-foot">
                  <button className="save-btn" onClick={updateItem}>저장</button>
                  <button className="delete-btn" onClick={() => deleteItem(selectedItem.type, selectedItem.id)}>삭제</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeManager;
