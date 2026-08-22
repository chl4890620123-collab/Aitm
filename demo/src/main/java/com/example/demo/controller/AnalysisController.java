package com.example.demo.controller;

import com.example.demo.dto.AnalysisRequest;
import com.example.demo.entity.AnalysisResult;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.service.AnalysisService;
import com.example.demo.service.VideoStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {
    private final AnalysisService analysisService;
    private final AnalysisResultRepository resultRepository;
    private final VideoStorageService videoStorageService;

    @GetMapping("/history")
    public ResponseEntity<List<AnalysisResult>> getHistory() {
        List<AnalysisResult> history = resultRepository.findAll();
        history.sort(Comparator.comparing(AnalysisResult::getResultId).reversed());
        return ResponseEntity.ok(history);
    }

    @PostMapping("/execute")
    public ResponseEntity<AnalysisResult> execute(@RequestBody AnalysisRequest request) {
        return ResponseEntity.ok(analysisService.runAnalysisScenario(request));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnalysisResult> uploadAndAnalyze(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "guest_user") String userId,
            @RequestParam String moveType,
            @RequestParam(defaultValue = "PRECISION") String mode,
            @RequestParam(defaultValue = "upload") String sourceType,
            @RequestParam(required = false) Double cameraDistance,
            @RequestParam(required = false) Double cameraHeight
    ) {
        VideoStorageService.StoredVideo stored = videoStorageService.store(file);
        try {
            AnalysisRequest request = new AnalysisRequest();
            request.setUserId(userId);
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
    public ResponseEntity<AnalysisResult> getResult(@PathVariable Long id) {
        return resultRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResult(@PathVariable Long id) {
        analysisService.deleteAnalysisResult(id);
        return ResponseEntity.noContent().build();
    }
}
