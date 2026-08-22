package com.example.demo.service;

import com.example.demo.entity.AnalysisResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ScoreCalculatorTest {
    private final ScoreCalculator calculator = new ScoreCalculator();
    private final ScoreCalculator.ScoreStandard standard = new ScoreCalculator.ScoreStandard(90.0, 280.0);

    @Test
    void highConfidenceAnalysisProducesCompletedScore() {
        AnalysisResult result = result(92, 90.0, 300.0, 90, 88);

        ScoreCalculator.ScoreResult score = calculator.calculate(result, standard);

        assertNotNull(score.totalScore());
        assertEquals("COMPLETED", score.status());
        assertTrue(score.totalScore() >= 80);
        assertEquals(100, score.breakdown().values().stream().mapToInt(ScoreCalculator.ScorePart::weight).sum());
    }

    @Test
    void lowConfidenceAnalysisDoesNotIssueFinalScore() {
        AnalysisResult result = result(48, 90.0, 300.0, 90, 88);

        ScoreCalculator.ScoreResult score = calculator.calculate(result, standard);

        assertNull(score.totalScore());
        assertEquals("LOW_CONFIDENCE", score.status());
    }

    @Test
    void mediumConfidenceRequiresReviewButKeepsMeasuredScore() {
        AnalysisResult result = result(65, 95.0, 270.0, 80, 75);

        ScoreCalculator.ScoreResult score = calculator.calculate(result, standard);

        assertNotNull(score.totalScore());
        assertEquals("REVIEW_REQUIRED", score.status());
    }

    @Test
    void missingMeasurementIsNotTreatedAsPerfect() {
        AnalysisResult result = result(90, null, null, 90, 90);

        ScoreCalculator.ScoreResult score = calculator.calculate(result, standard);

        assertEquals(0, score.breakdown().get("knee").score());
        assertEquals(0, score.breakdown().get("rotation").score());
    }

    private AnalysisResult result(int confidence, Double knee, Double rotation, int timing, int landing) {
        AnalysisResult result = new AnalysisResult();
        result.setAnalysisConfidence(confidence);
        result.setKneeMinAngleDeg(knee);
        result.setRotationAngularVelocity(rotation);
        result.setTimingSyncScore(timing);
        result.setLandingStabilityScore(landing);
        return result;
    }
}
