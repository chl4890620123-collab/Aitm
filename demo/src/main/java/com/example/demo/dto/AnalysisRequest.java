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
    // Server-owned snapshot; never trust client-supplied standards.
    private String standardData;
    private String standardVersion;
    // Optional YouTube reference for side-by-side visual coaching; never downloaded by the AI engine.
    private String referenceVideoUrl;
}
