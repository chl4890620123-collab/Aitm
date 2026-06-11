package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * 어플리케이션 공통 설정 클래스
 * 외부 서비스 통신 및 기타 빈(Bean) 설정을 정의합니다.
 */
@Configuration
public class AppConfig {

    /**
     * 외부 HTTP 통신을 위한 RestTemplate 빈 등록
     * AI 엔진(FastAPI)과의 통신 시 사용됩니다.
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
