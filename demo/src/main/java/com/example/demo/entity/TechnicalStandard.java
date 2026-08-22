package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "technical_standards")
@Getter
@Setter
public class TechnicalStandard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "standard_id")
    private Long id;

    @Column(unique = true, nullable = false)
    private String moveType;

    @Column(nullable = false)
    private String skillName;

    @Column(columnDefinition = "TEXT")
    private String standardData;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String injuryPrevention;

    @Column(columnDefinition = "TEXT")
    private String referenceVideoUrl;

    // Reproducibility/provenance metadata.
    private String standardVersion;
    private String sourceName;

    @Column(columnDefinition = "TEXT")
    private String sourceUrl;

    private Boolean verified;

    @PrePersist
    protected void applyDefaults() {
        if (standardVersion == null || standardVersion.isBlank()) {
            standardVersion = "0.1";
        }
        if (sourceName == null || sourceName.isBlank()) {
            sourceName = "출처 미지정";
        }
        if (verified == null) {
            verified = false;
        }
    }
}
