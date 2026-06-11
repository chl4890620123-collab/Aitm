package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "analysis_sessions")
@Getter @Setter
public class AnalysisSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "session_id")
    private Long sessionId;

    private String userId;

    // 물리 보정용 데이터
    @Column(name = "cam_distance_m")
    private Double camDistanceM;

    @Column(name = "cam_angle_deg")
    private Double camAngleDeg;

    @Column(name = "cam_height_cm")
    private Double camHeightCm;

    // 목표 설정
    private String targetHeightLevel;
    private String standardModelId;

    private LocalDateTime createdAt = LocalDateTime.now();
}