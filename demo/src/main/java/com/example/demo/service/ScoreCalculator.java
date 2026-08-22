package com.example.demo.service;

import com.example.demo.entity.AnalysisResult;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ScoreCalculator {
    public static final int MIN_SCORE_CONFIDENCE = 55;
    public static final int REVIEW_CONFIDENCE = 70;

    public ScoreResult calculate(AnalysisResult result, ScoreStandard standard) {
        ScoreStandard applied = standard != null ? standard : new ScoreStandard(90.0, 280.0);

        int kneeScore = result.getKneeMinAngleDeg() == null
                ? 0
                : rounded(clamp(100.0 - Math.abs(result.getKneeMinAngleDeg() - applied.idealKneeMinDeg()) * 1.5, 0.0, 100.0));

        int rotationScore = result.getRotationAngularVelocity() == null
                ? 0
                : rounded(clamp(result.getRotationAngularVelocity() / Math.max(1.0, applied.minRotationVelocityDegSec()) * 100.0, 0.0, 100.0));

        int timingScore = result.getTimingSyncScore() == null
                ? 0
                : rounded(clamp(result.getTimingSyncScore(), 0.0, 100.0));

        int landingScore = result.getLandingStabilityScore() == null
                ? 0
                : rounded(clamp(result.getLandingStabilityScore(), 0.0, 100.0));

        int confidenceScore = result.getAnalysisConfidence() == null
                ? 0
                : rounded(clamp(result.getAnalysisConfidence(), 0.0, 100.0));

        Map<String, ScorePart> breakdown = new LinkedHashMap<>();
        breakdown.put("knee", new ScorePart(kneeScore, 25));
        breakdown.put("rotation", new ScorePart(rotationScore, 30));
        breakdown.put("timing", new ScorePart(timingScore, 20));
        breakdown.put("landing", new ScorePart(landingScore, 15));
        breakdown.put("confidence", new ScorePart(confidenceScore, 10));

        if (confidenceScore < MIN_SCORE_CONFIDENCE) {
            return new ScoreResult(null, "LOW_CONFIDENCE", breakdown);
        }

        int total = rounded(
                kneeScore * 0.25
                        + rotationScore * 0.30
                        + timingScore * 0.20
                        + landingScore * 0.15
                        + confidenceScore * 0.10
        );

        String status = confidenceScore < REVIEW_CONFIDENCE ? "REVIEW_REQUIRED" : "COMPLETED";
        return new ScoreResult((int) clamp(total, 0.0, 100.0), status, breakdown);
    }

    private int rounded(double value) {
        return (int) Math.round(value);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    public record ScoreStandard(double idealKneeMinDeg, double minRotationVelocityDegSec) {
    }

    public record ScorePart(int score, int weight) {
    }

    public record ScoreResult(Integer totalScore, String status, Map<String, ScorePart> breakdown) {
    }
}
