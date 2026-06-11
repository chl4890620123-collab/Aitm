package com.example.demo.repository;

import com.example.demo.entity.TechnicalStandard;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TechnicalStandardRepository extends JpaRepository<TechnicalStandard, Long> {
    Optional<TechnicalStandard> findByMoveType(String moveType);
}
