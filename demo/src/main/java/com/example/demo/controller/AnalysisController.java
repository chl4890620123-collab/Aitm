package com.example.demo.controller;

import com.example.demo.entity.AnalysisResult;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.service.AnalysisService;
import com.example.demo.dto.AnalysisRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoint for Taekwondo Kinematics Analysis
 */
@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;
    private final AnalysisResultRepository resultRepository;

    @GetMapping("/history")
    public ResponseEntity<List<AnalysisResult>> getHistory() {
        return ResponseEntity.ok(resultRepository.findAll());
    }

    // Trigger full analysis pipeline (Inference -> Scoring -> Persistence)
    @PostMapping("/execute")
    public ResponseEntity<AnalysisResult> execute(@RequestBody AnalysisRequest request) {
        AnalysisResult result = analysisService.runAnalysisScenario(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<AnalysisResult> getResult(@PathVariable Long id) {
        return resultRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
    public ResponseEntity<?> deleteResult(@PathVariable("id") Long id) {
        try {
            analysisService.deleteAnalysisResult(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Delete Failed: " + e.getMessage());
        }
    }
}