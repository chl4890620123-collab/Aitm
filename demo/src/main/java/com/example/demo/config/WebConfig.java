package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 웹 설정 클래스
 * 애플리케이션의 웹 관련 보안 및 통신 설정을 담당합니다.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * CORS(Cross-Origin Resource Sharing) 설정
     * 프론트엔드(Vite, 5173 포트)에서 백엔드 API에 접근할 수 있도록 허용합니다.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // 프론트엔드 개발 서버 주소 허용
                .allowedOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                // 허용할 HTTP 메서드 정의
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                // 모든 헤더 허용
                .allowedHeaders("*")
                // 쿠키 및 인증 정보 포함 허용
                .allowCredentials(true);
    }
}
