package com.example.demo.repository;

import com.example.demo.entity.AnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AnalysisResultRepository extends JpaRepository<AnalysisResult, Long> {
    java.util.List<AnalysisResult> findBySession_UserIdOrderByResultIdDesc(String userId);
    java.util.Optional<AnalysisResult> findByResultIdAndSession_UserId(Long resultId, String userId);
}