package com.example.demo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "analysis_results")
@Getter
@Setter
public class AnalysisResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "result_id")
    private Long resultId;

    @Column(columnDefinition = "TEXT")
    private String videoUrl;
    private String moveType;

    // Legacy/compatibility metrics. New analyses populate only values that can be measured from pose data.
    private Double preLoadingFlexDeg;
    private Integer jumpBoostHeightCm;
    private Integer eyeLeadingTimeMs;
    private Double diagonalPathAngle;
    private Double rotationAngularVelocity;
    private Double totalRotationDeg;
    private Double upperBodyMomentum;
    private Double shoulderAccel;
    private Integer kneeTuckTransitionMs;
    private Integer handCompactnessScore;
    private Integer landingStabilityScore;
    private Integer timingSyncScore;
    private Integer nextMotionTransitionMs;

    // Pose-based measured metrics.
    private Double kneeMinAngleDeg;
    private Double hipRotationRangeDeg;
    private Double shoulderHipSeparationDeg;
    private Double jumpHeightRelative;
    private Double poseDetectionRate;
    private Integer analysisConfidence;

    private Integer totalScore;

    @Column(columnDefinition = "TEXT")
    private String aiFeedback;

    @Column(columnDefinition = "TEXT")
    private String analysisEventsJson;

    @Column(columnDefinition = "TEXT")
    private String qualityWarningsJson;

    @Column(columnDefinition = "TEXT")
    private String ragSourcesJson;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @JsonIgnore
    private AnalysisSession session;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
