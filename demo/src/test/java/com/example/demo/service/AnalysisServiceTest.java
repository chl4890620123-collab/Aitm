package com.example.demo.service;

import com.example.demo.entity.AnalysisResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AnalysisServiceTest {
    private final AnalysisService service = new AnalysisService(null, null, null);

    @Test
    void calculatesScoreWithoutRotationMetrics() {
        AnalysisResult result = new AnalysisResult();
        result.setShoulderAccel(150.0);
        result.setUpperBodyMomentum(90.0);
        result.setTimingSyncScore(80);
        result.setLandingStabilityScore(70);
        assertEquals(85, service.calculateTotalScore(result));
    }

    @Test
    void redistributesWeightsWhenMetricIsMissing() {
        AnalysisResult result = new AnalysisResult();
        result.setTimingSyncScore(80);
        result.setLandingStabilityScore(60);
        assertEquals(70, service.calculateTotalScore(result));
    }

    @Test
    void returnsZeroWhenNothingWasMeasured() {
        assertEquals(0, service.calculateTotalScore(new AnalysisResult()));
    }
}
