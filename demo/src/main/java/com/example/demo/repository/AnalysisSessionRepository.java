package com.example.demo.repository;

import com.example.demo.entity.AnalysisSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnalysisSessionRepository extends JpaRepository<AnalysisSession, Long> {
    // 특정 사용자의 최근 분석 세션 목록 가져오기
    List<AnalysisSession> findByUserIdOrderByCreatedAtDesc(String userId);
}