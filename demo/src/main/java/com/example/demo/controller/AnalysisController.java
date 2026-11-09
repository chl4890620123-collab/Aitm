package com.example.demo.controller;

import com.example.demo.dto.AnalysisRequest;
import com.example.demo.entity.AnalysisResult;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.service.AnalysisService;
import com.example.demo.service.VideoStorageService;
import com.example.demo.repository.UserAccountRepository;
import org.springframework.security.core.Authentication;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {
    private final AnalysisService analysisService;
    private final AnalysisResultRepository resultRepository;
    private final VideoStorageService videoStorageService;
    private final UserAccountRepository users;

    private String ownerId(Authentication auth) {
        return users.findByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new SecurityException("인증된 사용자가 없습니다."))
                .getId().toString();
    }

    @GetMapping("/history")
    public ResponseEntity<List<AnalysisResult>> getHistory(Authentication auth) {
        return ResponseEntity.ok(resultRepository.findBySession_UserIdOrderByResultIdDesc(ownerId(auth)));
    }

    @PostMapping("/execute")
    public ResponseEntity<AnalysisResult> execute(@RequestBody AnalysisRequest request, Authentication auth) {
        request.setUserId(ownerId(auth));
        return ResponseEntity.ok(analysisService.runAnalysisScenario(request));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnalysisResult> uploadAndAnalyze(
            @RequestPart("file") MultipartFile file,
            @RequestParam String moveType,
            @RequestParam(defaultValue = "PRECISION") String mode,
            @RequestParam(defaultValue = "upload") String sourceType,
            @RequestParam(required = false) Double cameraDistance,
            @RequestParam(required = false) Double cameraHeight,
            Authentication auth
    ) {
        VideoStorageService.StoredVideo stored = videoStorageService.store(file);
        try {
            AnalysisRequest request = new AnalysisRequest();
            request.setUserId(ownerId(auth));
            request.setMoveType(moveType);
            request.setMode(mode);
            request.setSourceType(sourceType);
            request.setCameraDistance(cameraDistance);
            request.setCameraHeight(cameraHeight);
            request.setFileSize(stored.size());
            request.setFileExtension(stored.extension());
            request.setVideoUrl(stored.analysisUri());
            request.setPlaybackUrl(stored.playbackUrl());
            return ResponseEntity.ok(analysisService.runAnalysisScenario(request));
        } catch (RuntimeException ex) {
            videoStorageService.deletePlaybackUrl(stored.playbackUrl());
            throw ex;
        }
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<AnalysisResult> getResult(@PathVariable Long id, Authentication auth) {
        return resultRepository.findByResultIdAndSession_UserId(id, ownerId(auth))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResult(@PathVariable Long id, Authentication auth) {
        analysisService.deleteAnalysisResult(id, ownerId(auth));
        return ResponseEntity.noContent().build();
    }
}
