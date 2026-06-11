package com.example.demo.service;

import com.example.demo.entity.AnalysisResult;
import com.example.demo.entity.AnalysisSession;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.repository.AnalysisSessionRepository;
import com.example.demo.dto.AnalysisRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisResultRepository resultRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final RestTemplate restTemplate;

    @Value("${restok.ai.secure-token}")
    private String secureToken;

    @Value("${restok.ai.engine-url}")
    private String pythonEngineUrl;

    // Security White-list (Domains & Extensions)
    private static final List<String> ALLOWED_DOMAINS = Arrays.asList(
            "s3.amazonaws.com", "storage.googleapis.com", "gabia.io", "localhost", "127.0.0.1", "uploaded://", "blob:"
    );
    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList("mp4", "mov", "avi");
    private static final long MAX_FILE_SIZE = 500 * 1024 * 1024;

    /**
     * 분석 파이프라인 실행: 보안 검증 -> 세션 바인딩 -> AI 엔진 추론 -> 점수 산출 -> Persistence
     */
    public AnalysisResult runAnalysisScenario(AnalysisRequest request) {
        validateRequestSecurity(request);

        AnalysisSession session = (request.getSessionId() != null) 
            ? sessionRepository.findById(request.getSessionId()).orElseGet(() -> createDefaultSession(request.getUserId()))
            : createDefaultSession(request.getUserId());

        // AI 엔진 인증 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-RESTOK-AI-TOKEN", secureToken);

        HttpEntity<AnalysisRequest> entity = new HttpEntity<>(request, headers);
        AnalysisResult analyzedData = restTemplate.postForObject(pythonEngineUrl, entity, AnalysisResult.class);

        if (analyzedData == null) throw new RuntimeException("AI Inference Failed");

        // 도메인 로직 기반 채점 및 데이터 저장
        analyzedData.setTotalScore(calculateTotalScore(analyzedData));
        analyzedData.setResultId(null); 
        analyzedData.setSession(session);
        analyzedData.setVideoUrl(request.getVideoUrl()); 

        return resultRepository.save(analyzedData);
    }

    /**
     * 역학 지표 기반 정밀 채점 알고리즘
     * 가속도, 추진력, 각속도 등의 물리 지표를 가중치에 따라 합산하며 회전수 미달 시 패널티를 적용함.
     */
    private int calculateTotalScore(AnalysisResult s) {
        if (s == null) return 0;

        double accel = s.getShoulderAccel() != null ? s.getShoulderAccel() : 0;
        double momentum = s.getUpperBodyMomentum() != null ? s.getUpperBodyMomentum() : 0;
        double rotation = s.getRotationAngularVelocity() != null ? s.getRotationAngularVelocity() : 0;
        int sync = s.getTimingSyncScore() != null ? s.getTimingSyncScore() : 0;
        int landing = s.getLandingStabilityScore() != null ? s.getLandingStabilityScore() : 0;

        // 지표별 Normalize (기준값 대비 백분율)
        double accelScore = Math.min(100, (accel / 150.0) * 100);
        double momentumScore = Math.min(100, (momentum / 90.0) * 100);
        double rotationScore = Math.min(100, (rotation / 750.0) * 100);

        // 기술 코드별 최소 각속도 Threshold 설정
        double rotationThreshold = 550.0; 
        if (s.getMoveType() != null) {
            if (s.getMoveType().contains("720")) rotationThreshold = 700.0;
            else if (s.getMoveType().contains("1080")) rotationThreshold = 850.0;
        }

        // 가중치 비중: 가속(15%), 추진(15%), 회전(30%), 싱크(20%), 착지(20%)
        double rawTotal = (accelScore * 0.15) + (momentumScore * 0.15) + (rotationScore * 0.30) + (sync * 0.20) + (landing * 0.20);
        int total = (int) Math.round(rawTotal);

        // 회전 부족 시 Hard Penalty 적용 (고득점 차단)
        if (rotation < rotationThreshold) {
            double deficiencyRatio = (rotationThreshold - rotation) / rotationThreshold;
            total -= (int) (deficiencyRatio * 25) + 15;
            int scoreCap = 85 - (int)(deficiencyRatio * 30);
            if (total > scoreCap) total = scoreCap;
        }

        // Master Level 보정 (올-라운드 지표 만족 시에만 100점 허용)
        if (total >= 96 && (rotation < rotationThreshold || rotationScore < 95 || accelScore < 90)) {
            total = 95; 
        }

        return Math.max(5, total);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteAnalysisResult(Long resultId) {
        if (!resultRepository.existsById(resultId)) throw new RuntimeException("Entity Not Found: " + resultId);
        resultRepository.deleteById(resultId);
    }

    private AnalysisSession createDefaultSession(String userId) {
        AnalysisSession session = new AnalysisSession();
        session.setUserId(userId != null ? userId : "guest_user");
        session.setCamDistanceM(3.0);
        session.setCamHeightCm(120.0);
        return sessionRepository.save(session);
    }

    private void validateRequestSecurity(AnalysisRequest request) {
        if (ALLOWED_DOMAINS.stream().noneMatch(request.getVideoUrl()::contains)) {
            throw new SecurityException("Forbidden Domain Source");
        }

        String url = request.getVideoUrl().toLowerCase();
        boolean hasValidExt = ALLOWED_EXTENSIONS.stream().anyMatch(url::endsWith) || 
                             (request.getFileExtension() != null && ALLOWED_EXTENSIONS.contains(request.getFileExtension().toLowerCase()));

        if (!url.startsWith("http") && !hasValidExt) throw new SecurityException("Unsupported File Format");
        if (request.getFileSize() != null && request.getFileSize() > MAX_FILE_SIZE) throw new SecurityException("File Size Exceeded");
    }
}