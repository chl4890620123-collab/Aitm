package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "analysis_results")
@Getter @Setter
public class AnalysisResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "result_id")
    private Long resultId;

    private String videoUrl; 
    private String moveType;

    // Biomechanical Metrics
    private Double preLoadingFlexDeg;      
    private Integer jumpBoostHeightCm;     
    private Integer eyeLeadingTimeMs;      
    private Double diagonalPathAngle;      
    private Double rotationAngularVelocity; 

    @com.fasterxml.jackson.annotation.JsonProperty("totalRotationDeg")
    private Double totalRotationDeg;       

    // Aggregated Physics Fields
    private Double upperBodyMomentum;      
    private Double shoulderAccel;          
    private Integer kneeTuckTransitionMs;  
    private Integer handCompactnessScore;  
    private Integer landingStabilityScore;  
    private Integer timingSyncScore;       
    private Integer nextMotionTransitionMs; 

    private Integer totalScore;            

    @Column(columnDefinition = "TEXT")
    private String aiFeedback; // RAG generated diagnostic report

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private AnalysisSession session;
}