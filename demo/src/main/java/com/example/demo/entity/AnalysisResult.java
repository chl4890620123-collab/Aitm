package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "analysis_results")
@Getter @Setter
public class AnalysisResult {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "result_id")
    private Long resultId;
    private String videoUrl;
    private String moveType;
    private Integer jumpBoostHeightCm;
    private Double upperBodyMomentum;
    private Double shoulderAccel;
    private Integer kneeTuckTransitionMs;
    private Integer landingStabilityScore;
    private Integer timingSyncScore;
    private Integer analyzedFrames;
    private Double videoFps;
    private Integer totalScore;

    @Column(columnDefinition = "TEXT")
    private String aiFeedback;

    @Transient
    private Object ragEvidence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private AnalysisSession session;
}
