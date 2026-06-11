package com.example.demo.repository;

import com.example.demo.entity.TaekwondoKnowledge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaekwondoKnowledgeRepository extends JpaRepository<TaekwondoKnowledge, Long> {
}
