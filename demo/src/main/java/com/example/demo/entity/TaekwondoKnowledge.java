package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "taekwondo_knowledge")
@Getter @Setter
public class TaekwondoKnowledge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "knowledge_id")
    private Long id;

    @Column(name = "technical_point", nullable = false)
    private String technicalPoint; // 예: '상체 가속', '착지 안정성'

    @Column(name = "criteria_value")
    private Double criteriaValue; // 기준값

    @Column(name = "coaching_message", columnDefinition = "TEXT")
    private String coachingMessage; // RAG용 전문 지식

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
