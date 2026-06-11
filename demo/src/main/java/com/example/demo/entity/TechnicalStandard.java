package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * 기술 표준 엔티티
 * 특정 태권도 기술의 마스터 데이터(정답지)를 저장합니다.
 */
@Entity
@Table(name = "technical_standards")
@Getter @Setter
public class TechnicalStandard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "standard_id")
    private Long id;

    // 기술 식별 코드 (예: dolgechigi, kick_720 등)
    @Column(unique = true)
    private String moveType;    
    
    // 기술의 정식 명칭
    private String skillName;
    
    // JSON 형태의 물리 표준 지표 (기준 가속도, 기준 각도 등)
    @Column(columnDefinition = "TEXT")
    private String standardData; 
    
    // 기술에 대한 상세 설명 및 역학적 원리
    @Column(columnDefinition = "TEXT")
    private String description;
    
    // 해당 기술 수행 시 주의해야 할 부상 방지 수칙
    @Column(columnDefinition = "TEXT")
    private String injuryPrevention;

    // 수련자가 참고할 수 있는 마스터의 표준 시연 영상 URL
    @Column(columnDefinition = "TEXT")
    private String referenceVideoUrl; 
}
