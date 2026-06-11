package com.example.demo.controller;

import com.example.demo.entity.TaekwondoKnowledge;
import com.example.demo.repository.TaekwondoKnowledgeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 태권도 지식(채점 기준) 컨트롤러
 * AI가 분석 시 참고하는 역학적 기준 및 코칭 메시지를 관리합니다.
 */
@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
public class KnowledgeController {

    private final TaekwondoKnowledgeRepository knowledgeRepository;

    /**
     * 모든 지식 데이터 조회
     */
    @GetMapping
    public List<TaekwondoKnowledge> getAll() {
        return knowledgeRepository.findAll();
    }

    /**
     * 새로운 지식(채점 항목) 등록
     */
    @PostMapping
    public TaekwondoKnowledge create(@RequestBody TaekwondoKnowledge knowledge) {
        return knowledgeRepository.save(knowledge);
    }

    /**
     * 지식 데이터 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        knowledgeRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    /**
     * 지식 데이터 수정
     */
    @PutMapping("/{id}")
    public ResponseEntity<TaekwondoKnowledge> update(@PathVariable Long id, @RequestBody TaekwondoKnowledge updatedKnowledge) {
        return knowledgeRepository.findById(id)
                .map(existing -> {
                    existing.setTechnicalPoint(updatedKnowledge.getTechnicalPoint());
                    existing.setCriteriaValue(updatedKnowledge.getCriteriaValue());
                    existing.setCoachingMessage(updatedKnowledge.getCoachingMessage());
                    return ResponseEntity.ok(knowledgeRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
