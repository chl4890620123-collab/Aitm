package com.example.demo.config;

import com.example.demo.entity.TaekwondoKnowledge;
import com.example.demo.entity.TechnicalStandard;
import com.example.demo.repository.TaekwondoKnowledgeRepository;
import com.example.demo.repository.TechnicalStandardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final TechnicalStandardRepository standardRepository;
    private final TaekwondoKnowledgeRepository knowledgeRepository;

    @Override
    public void run(String... args) {
        seedStandard(
                "dolgechigi",
                "돌개차기",
                "회전 시작, 무릎 수축, 골반 회전, 착지를 연속적으로 확인하는 프로젝트 기본 분석 기술입니다.",
                "{\"idealKneeMinDeg\":90,\"kneeToleranceDeg\":20,\"minRotationVelocityDegSec\":280,\"minLandingStabilityScore\":75,\"idealKneeToRotationMs\":180,\"timingToleranceMs\":180}"
        );
        seedStandard(
                "dwichigi",
                "뒤차기",
                "골반 회전과 지지발 안정성, 차는 다리의 수축-신전 타이밍을 확인합니다.",
                "{\"idealKneeMinDeg\":100,\"kneeToleranceDeg\":22,\"minRotationVelocityDegSec\":220,\"minLandingStabilityScore\":78,\"idealKneeToRotationMs\":160,\"timingToleranceMs\":180}"
        );
        seedStandard(
                "huryeochigi",
                "후려차기",
                "무릎 수축과 골반 회전, 동작 피크 이후 중심 안정성을 확인합니다.",
                "{\"idealKneeMinDeg\":105,\"kneeToleranceDeg\":22,\"minRotationVelocityDegSec\":250,\"minLandingStabilityScore\":76,\"idealKneeToRotationMs\":170,\"timingToleranceMs\":180}"
        );

        if (knowledgeRepository.count() == 0) {
            seedKnowledge("무릎 수축", 90.0, "무릎 수축 시점과 최소 각도를 기준 영상과 비교하고, 회전 피크 전에 충분히 접히는지 확인합니다.");
            seedKnowledge("골반 회전", 280.0, "회전 속도 숫자 하나보다 골반 회전이 시작되는 시점과 무릎 수축의 순서를 함께 확인합니다.");
            seedKnowledge("착지 안정성", 75.0, "착지 후 골반 중심과 상체 기울기의 흔들림을 확인하고 발-무릎 방향을 함께 점검합니다.");
        }
    }

    private void seedStandard(String moveType, String name, String description, String standardData) {
        if (standardRepository.findByMoveType(moveType).isPresent()) {
            return;
        }
        TechnicalStandard standard = new TechnicalStandard();
        standard.setMoveType(moveType);
        standard.setSkillName(name);
        standard.setDescription(description + " 기준값은 프로젝트 기본값이며 지도자 검증 후 수정할 수 있습니다.");
        standard.setInjuryPrevention("통증이 발생하면 분석을 중단하고 지도자 또는 전문가의 확인을 받으세요.");
        standard.setStandardData(standardData);
        standardRepository.save(standard);
    }

    private void seedKnowledge(String point, double criteria, String message) {
        TaekwondoKnowledge knowledge = new TaekwondoKnowledge();
        knowledge.setTechnicalPoint(point);
        knowledge.setCriteriaValue(criteria);
        knowledge.setCoachingMessage(message);
        knowledgeRepository.save(knowledge);
    }
}
