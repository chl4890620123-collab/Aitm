package com.example.demo.controller;

import com.example.demo.entity.TechnicalStandard;
import com.example.demo.repository.TechnicalStandardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 기술 표준 컨트롤러
 * 태권도 기술별 물리적 표준 데이터(각도, 속도 등)와 교본 정보를 관리합니다.
 */
@RestController
@RequestMapping("/api/standards")
@RequiredArgsConstructor
public class StandardController {

    private final TechnicalStandardRepository standardRepository;

    /**
     * 모든 기술 표준 목록 조회
     */
    @GetMapping
    public List<TechnicalStandard> getAll() {
        return standardRepository.findAll();
    }

    /**
     * 새로운 기술 표준 등록
     */
    @PostMapping
    public TechnicalStandard create(@RequestBody TechnicalStandard standard) {
        return standardRepository.save(standard);
    }

    /**
     * 특정 기술 표준 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        standardRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    /**
     * 기술 표준 정보 수정
     */
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
                    return ResponseEntity.ok(standardRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 기술 코드(moveType) 기반 단일 표준 데이터 조회
     */
    @GetMapping("/{moveType}")
    public ResponseEntity<TechnicalStandard> getByMoveType(@PathVariable String moveType) {
        return standardRepository.findByMoveType(moveType)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
