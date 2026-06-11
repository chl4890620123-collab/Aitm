package com.example.demo.dto;

import lombok.Data;

/**
 * 분석 요청 DTO
 * 클라이언트(프론트엔드)에서 백엔드로 분석을 요청할 때 사용하는 데이터 구조입니다.
 */
@Data
public class AnalysisRequest {
    // 사용자 식별자 (프론트엔드 기준점)
    private String userId;

    // 수련 세션 식별자
    private Long sessionId;        
    
    // 분석할 영상 파일의 경로 또는 외부 URL
    private String videoUrl;       
    
    // 분석할 기술 코드 (예: dolgechigi)
    private String moveType;       
    
    // 분석 모드 (QUICK: 고속 분석, PRECISION: 정밀 분석)
    private String mode;           
    
    // 보정용 지표: 카메라와 피사체 사이의 거리 (단위: m)
    private Double cameraDistance; 
    
    // 보정용 지표: 카메라 설치 높이 (단위: cm)
    private Double cameraHeight;   
    
    // 🛡️ 보안 검증: 영상 파일의 크기
    private Long fileSize;         
    
    // 🛡️ 보안 검증: 영상 파일의 확장자
    private String fileExtension;  
}