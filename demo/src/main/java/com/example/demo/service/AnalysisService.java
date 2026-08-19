package com.example.demo.service;

import com.example.demo.dto.AnalysisRequest;
import com.example.demo.entity.AnalysisResult;
import com.example.demo.entity.AnalysisSession;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.repository.AnalysisSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AnalysisService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm");
    private static final long MAX_FILE_SIZE = 500L * 1024 * 1024;

    private final AnalysisResultRepository resultRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final RestTemplate restTemplate;

    @Value("${restok.ai.secure-token}") private String secureToken;
    @Value("${restok.ai.engine-url}") private String pythonEngineUrl;
    @Value("${restok.video.allowed-hosts:localhost,127.0.0.1,s3.amazonaws.com,storage.googleapis.com}")
    private List<String> allowedHosts;

    public AnalysisResult runAnalysisScenario(AnalysisRequest request) {
        validateRequestSecurity(request);
        AnalysisSession session = request.getSessionId() == null
                ? createDefaultSession(request.getUserId())
                : sessionRepository.findById(request.getSessionId()).orElseGet(() -> createDefaultSession(request.getUserId()));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-RESTOK-AI-TOKEN", secureToken);
        AnalysisResult analyzed = restTemplate.postForObject(
                pythonEngineUrl, new HttpEntity<>(request, headers), AnalysisResult.class);
        if (analyzed == null) throw new IllegalStateException("AI inference returned no data");

        analyzed.setTotalScore(calculateTotalScore(analyzed));
        analyzed.setResultId(null);
        analyzed.setSession(session);
        analyzed.setVideoUrl(request.getVideoUrl());
        return resultRepository.save(analyzed);
    }

    int calculateTotalScore(AnalysisResult result) {
        if (result == null) return 0;
        double weighted = 0;
        double weights = 0;
        if (result.getShoulderAccel() != null) {
            weighted += clamp(result.getShoulderAccel() / 150.0 * 100) * 0.20; weights += 0.20;
        }
        if (result.getUpperBodyMomentum() != null) {
            weighted += clamp(result.getUpperBodyMomentum() / 90.0 * 100) * 0.20; weights += 0.20;
        }
        if (result.getTimingSyncScore() != null) {
            weighted += clamp(result.getTimingSyncScore()) * 0.30; weights += 0.30;
        }
        if (result.getLandingStabilityScore() != null) {
            weighted += clamp(result.getLandingStabilityScore()) * 0.30; weights += 0.30;
        }
        return weights == 0 ? 0 : (int) Math.round(clamp(weighted / weights));
    }

    private double clamp(double value) { return Math.max(0, Math.min(100, value)); }

    @org.springframework.transaction.annotation.Transactional
    public void deleteAnalysisResult(Long resultId) {
        if (!resultRepository.existsById(resultId)) throw new IllegalArgumentException("Result not found: " + resultId);
        resultRepository.deleteById(resultId);
    }

    private AnalysisSession createDefaultSession(String userId) {
        AnalysisSession session = new AnalysisSession();
        session.setUserId(userId == null || userId.isBlank() ? "guest_user" : userId);
        session.setCamDistanceM(3.0);
        session.setCamHeightCm(120.0);
        return sessionRepository.save(session);
    }

    private void validateRequestSecurity(AnalysisRequest request) {
        if (request == null || request.getVideoUrl() == null || request.getVideoUrl().isBlank())
            throw new IllegalArgumentException("videoUrl is required");
        if (request.getFileSize() != null && request.getFileSize() > MAX_FILE_SIZE)
            throw new SecurityException("File size exceeded");

        String source = request.getVideoUrl();
        if (source.startsWith("/data/videos/")) {
            if (!source.matches("/data/videos/[a-fA-F0-9-]+\\.(mp4|mov|avi|webm)"))
                throw new SecurityException("Invalid stored video path");
            return;
        }

        URI uri;
        try { uri = URI.create(source); } catch (Exception e) { throw new SecurityException("Invalid video URL"); }
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())))
            throw new SecurityException("Only HTTP(S) URLs are allowed");
        String host = uri.getHost();
        boolean allowed = host != null && allowedHosts.stream()
                .map(String::trim).filter(value -> !value.isBlank())
                .anyMatch(value -> host.equalsIgnoreCase(value) || host.toLowerCase(Locale.ROOT).endsWith("." + value.toLowerCase(Locale.ROOT)));
        if (!allowed) throw new SecurityException("Forbidden video host");
        String extension = request.getFileExtension() == null ? "" : request.getFileExtension().toLowerCase(Locale.ROOT);
        if (!extension.isBlank() && !ALLOWED_EXTENSIONS.contains(extension))
            throw new SecurityException("Unsupported video extension");
    }
}
