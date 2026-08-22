package com.example.demo.dto;

import lombok.Data;

@Data
public class AnalysisRequest {
    private String userId;
    private Long sessionId;
    private String videoUrl;
    private String playbackUrl;
    private String sourceType;
    private String moveType;
    private String mode;
    private Double cameraDistance;
    private Double cameraHeight;
    private Long fileSize;
    private String fileExtension;
}
