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
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
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
    private final ScoreCalculator scoreCalculator;
    private final VideoStorageService videoStorageService;

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

        StandardSnapshot standard = loadStandardSnapshot(request.getMoveType());
        ScoreCalculator.ScoreResult score = scoreCalculator.calculate(analyzedData, standard.scoreStandard());

        analyzedData.setResultId(null);
        analyzedData.setSession(session);
        analyzedData.setVideoUrl(
                request.getPlaybackUrl() != null && !request.getPlaybackUrl().isBlank()
                        ? request.getPlaybackUrl()
                        : request.getVideoUrl()
        );
        analyzedData.setMoveType(request.getMoveType());
        analyzedData.setTotalScore(score.totalScore());
        analyzedData.setAnalysisStatus(score.status());
        analyzedData.setScoreBreakdownJson(toJson(score.breakdown()));
        analyzedData.setStandardVersion(standard.version());
        analyzedData.setStandardSourceName(standard.sourceName());
        analyzedData.setStandardVerified(standard.verified());
        analyzedData.setStandardSnapshotJson(toJson(standard.snapshot()));

        return resultRepository.save(analyzedData);
    }

    private StandardSnapshot loadStandardSnapshot(String moveType) {
        ScoreCalculator.ScoreStandard defaults = new ScoreCalculator.ScoreStandard(90.0, 280.0);
        TechnicalStandard entity = moveType == null || moveType.isBlank()
                ? null
                : standardRepository.findByMoveType(moveType).orElse(null);

        if (entity == null) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("moveType", moveType);
            snapshot.put("version", "fallback-0.1");
            snapshot.put("sourceName", "AITM fallback project baseline");
            snapshot.put("verified", false);
            snapshot.put("standardData", "{\"idealKneeMinDeg\":90,\"minRotationVelocityDegSec\":280}");
            return new StandardSnapshot(defaults, "fallback-0.1", "AITM fallback project baseline", false, snapshot);
        }

        ScoreCalculator.ScoreStandard scoreStandard = parseScoreStandard(entity.getStandardData(), defaults);
        String version = blankTo(entity.getStandardVersion(), "0.1");
        String sourceName = blankTo(entity.getSourceName(), "출처 미지정");
        boolean verified = Boolean.TRUE.equals(entity.getVerified());

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("moveType", entity.getMoveType());
        snapshot.put("skillName", entity.getSkillName());
        snapshot.put("version", version);
        snapshot.put("sourceName", sourceName);
        snapshot.put("sourceUrl", entity.getSourceUrl());
        snapshot.put("verified", verified);
        snapshot.put("standardData", entity.getStandardData());

        return new StandardSnapshot(scoreStandard, version, sourceName, verified, snapshot);
    }

    private ScoreCalculator.ScoreStandard parseScoreStandard(String raw, ScoreCalculator.ScoreStandard defaults) {
        if (raw == null || raw.isBlank()) {
            return defaults;
        }
        try {
            JsonNode node = objectMapper.readTree(raw);
            return new ScoreCalculator.ScoreStandard(
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

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
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
        AnalysisResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new IllegalArgumentException("분석 기록을 찾을 수 없습니다: " + resultId));
        String videoUrl = result.getVideoUrl();
        resultRepository.delete(result);
        resultRepository.flush();
        videoStorageService.deletePlaybackUrl(videoUrl);
    }

    private record StandardSnapshot(
            ScoreCalculator.ScoreStandard scoreStandard,
            String version,
            String sourceName,
            boolean verified,
            Map<String, Object> snapshot
    ) {
    }
}
