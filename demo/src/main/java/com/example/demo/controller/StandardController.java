package com.example.demo.controller;

import com.example.demo.entity.TechnicalStandard;
import com.example.demo.repository.TechnicalStandardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/standards")
@RequiredArgsConstructor
public class StandardController {
    private final TechnicalStandardRepository standardRepository;

    @GetMapping
    public List<TechnicalStandard> getAll() {
        return standardRepository.findAll();
    }

    @PostMapping
    public TechnicalStandard create(@RequestBody TechnicalStandard standard) {
        return standardRepository.save(standard);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        standardRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<TechnicalStandard> update(@PathVariable Long id, @RequestBody TechnicalStandard updatedStandard) {
        return standardRepository.findById(id)
                .map(existing -> {
                    existing.setMoveType(updatedStandard.getMoveType());
                    existing.setSkillName(updatedStandard.getSkillName());
                    existing.setDescription(updatedStandard.getDescription());
                    existing.setReferenceVideoUrl(updatedStandard.getReferenceVideoUrl());
                    existing.setInjuryPrevention(updatedStandard.getInjuryPrevention());
                    existing.setStandardData(updatedStandard.getStandardData());
                    existing.setStandardVersion(updatedStandard.getStandardVersion());
                    existing.setSourceName(updatedStandard.getSourceName());
                    existing.setSourceUrl(updatedStandard.getSourceUrl());
                    existing.setVerified(updatedStandard.getVerified());
                    return ResponseEntity.ok(standardRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{moveType}")
    public ResponseEntity<TechnicalStandard> getByMoveType(@PathVariable String moveType) {
        return standardRepository.findByMoveType(moveType)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
