package com.example.demo.service;

import com.example.demo.dto.AnalysisRequest;
import com.example.demo.entity.AnalysisResult;
import com.example.demo.entity.AnalysisSession;
import com.example.demo.entity.TechnicalStandard;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.repository.AnalysisSessionRepository;
import com.example.demo.repository.TechnicalStandardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AnalysisService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm", "mkv");

    private final AnalysisResultRepository resultRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final TechnicalStandardRepository standardRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${restok.ai.secure-token}")
    private String secureToken;

    @Value("${restok.ai.engine-url}")
    private String pythonEngineUrl;

    @Value("${aitm.storage.video-dir:./data/videos}")
    private String videoDirectory;

    @Value("${aitm.security.allowed-video-hosts:storage.googleapis.com}")
    private String allowedVideoHosts;

    @Transactional
    public AnalysisResult runAnalysisScenario(AnalysisRequest request) {
        validateRequestSecurity(request);

        AnalysisSession session = request.getSessionId() != null
                ? sessionRepository.findById(request.getSessionId())
                    .orElseGet(() -> createDefaultSession(request))
                : createDefaultSession(request);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-RESTOK-AI-TOKEN", secureToken);

        AnalysisResult analyzedData = restTemplate.postForObject(
                pythonEngineUrl,
                new HttpEntity<>(request, headers),
                AnalysisResult.class
        );

        if (analyzedData == null) {
            throw new IllegalStateException("AI 분석 엔진이 결과를 반환하지 않았습니다.");
        }

        analyzedData.setResultId(null);
        analyzedData.setSession(session);
        analyzedData.setVideoUrl(
                request.getPlaybackUrl() != null && !request.getPlaybackUrl().isBlank()
                        ? request.getPlaybackUrl()
                        : request.getVideoUrl()
        );
        analyzedData.setMoveType(request.getMoveType());
        analyzedData.setTotalScore(calculateTotalScore(analyzedData, request.getMoveType()));
        return resultRepository.save(analyzedData);
    }

    private int calculateTotalScore(AnalysisResult result, String moveType) {
        ScoreStandard standard = loadScoreStandard(moveType);

        double knee = valueOr(result.getKneeMinAngleDeg(), standard.idealKneeMinDeg());
        double kneeDelta = Math.abs(knee - standard.idealKneeMinDeg());
        double kneeScore = clamp(100.0 - kneeDelta * 1.5, 0.0, 100.0);

        double rotation = valueOr(result.getRotationAngularVelocity(), 0.0);
        double rotationScore = clamp(rotation / Math.max(1.0, standard.minRotationVelocityDegSec()) * 100.0, 0.0, 100.0);

        double timingScore = clamp(valueOr(result.getTimingSyncScore(), 0), 0.0, 100.0);
        double landingScore = clamp(valueOr(result.getLandingStabilityScore(), 0), 0.0, 100.0);
        double confidenceScore = clamp(valueOr(result.getAnalysisConfidence(), 0), 0.0, 100.0);

        double total = kneeScore * 0.25
                + rotationScore * 0.30
                + timingScore * 0.20
                + landingScore * 0.15
                + confidenceScore * 0.10;

        int rounded = (int) Math.round(total);
        if (confidenceScore < 60.0) {
            rounded = Math.min(rounded, 65);
        }
        return (int) clamp(rounded, 0, 100);
    }

    private ScoreStandard loadScoreStandard(String moveType) {
        ScoreStandard defaults = new ScoreStandard(90.0, 280.0);
        if (moveType == null || moveType.isBlank()) {
            return defaults;
        }
        return standardRepository.findByMoveType(moveType)
                .map(TechnicalStandard::getStandardData)
                .filter(raw -> raw != null && !raw.isBlank())
                .map(raw -> parseScoreStandard(raw, defaults))
                .orElse(defaults);
    }

    private ScoreStandard parseScoreStandard(String raw, ScoreStandard defaults) {
        try {
            JsonNode node = objectMapper.readTree(raw);
            return new ScoreStandard(
                    jsonDouble(node, "idealKneeMinDeg", defaults.idealKneeMinDeg()),
                    jsonDouble(node, "minRotationVelocityDegSec", defaults.minRotationVelocityDegSec())
            );
        } catch (Exception ignored) {
            return defaults;
        }
    }

    private double jsonDouble(JsonNode node, String key, double fallback) {
        JsonNode value = node.get(key);
        return value != null && value.isNumber() ? value.asDouble() : fallback;
    }

    private AnalysisSession createDefaultSession(AnalysisRequest request) {
        AnalysisSession session = new AnalysisSession();
        session.setUserId(request.getUserId() != null && !request.getUserId().isBlank() ? request.getUserId() : "guest_user");
        session.setCamDistanceM(request.getCameraDistance() != null ? request.getCameraDistance() : 3.0);
        session.setCamHeightCm(request.getCameraHeight() != null ? request.getCameraHeight() : 120.0);
        return sessionRepository.save(session);
    }

    private void validateRequestSecurity(AnalysisRequest request) {
        if (request == null || request.getVideoUrl() == null || request.getVideoUrl().isBlank()) {
            throw new IllegalArgumentException("영상 경로가 필요합니다.");
        }
        if (request.getMoveType() == null || request.getMoveType().isBlank()) {
            throw new IllegalArgumentException("분석할 기술을 선택하세요.");
        }

        String extension = request.getFileExtension() == null ? "" : request.getFileExtension().toLowerCase(Locale.ROOT);
        if (!extension.isBlank() && !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new SecurityException("지원하지 않는 영상 확장자입니다.");
        }

        URI uri;
        try {
            uri = URI.create(request.getVideoUrl());
        } catch (IllegalArgumentException ex) {
            throw new SecurityException("잘못된 영상 URL입니다.");
        }

        if ("file".equalsIgnoreCase(uri.getScheme())) {
            String sourceType = request.getSourceType() == null ? "" : request.getSourceType().toLowerCase(Locale.ROOT);
            if (!sourceType.equals("upload") && !sourceType.equals("camera")) {
                throw new SecurityException("로컬 파일은 업로드 또는 카메라 입력에서만 사용할 수 있습니다.");
            }
            Path root = Path.of(videoDirectory).toAbsolutePath().normalize();
            Path requested = Path.of(uri).toAbsolutePath().normalize();
            if (!requested.startsWith(root)) {
                throw new SecurityException("허용되지 않은 로컬 영상 경로입니다.");
            }
            return;
        }

        if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
            throw new SecurityException("HTTP(S) 또는 저장된 영상만 분석할 수 있습니다.");
        }
        if (uri.getHost() == null || !isAllowedRemoteHost(uri.getHost())) {
            throw new SecurityException("허용되지 않은 외부 영상 호스트입니다.");
        }
    }

    private boolean isAllowedRemoteHost(String host) {
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        return Arrays.stream(allowedVideoHosts.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .anyMatch(allowed -> normalizedHost.equals(allowed) || normalizedHost.endsWith("." + allowed));
    }

    @Transactional
    public void deleteAnalysisResult(Long resultId) {
        if (!resultRepository.existsById(resultId)) {
            throw new IllegalArgumentException("분석 기록을 찾을 수 없습니다: " + resultId);
        }
        resultRepository.deleteById(resultId);
    }

    private double valueOr(Double value, double fallback) {
        return value == null ? fallback : value;
    }

    private double valueOr(Integer value, int fallback) {
        return value == null ? fallback : value.doubleValue();
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private record ScoreStandard(double idealKneeMinDeg, double minRotationVelocityDegSec) {
    }
}
