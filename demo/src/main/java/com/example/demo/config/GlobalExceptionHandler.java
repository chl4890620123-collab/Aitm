package com.example.demo.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * 전역 예외 처리기
 * 애플리케이션 내에서 발생하는 모든 예외를 포착하여 공통된 형식의 에러 응답을 반환합니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 모든 예외(Exception) 처리 핸들러
     * @param ex 발생한 예외 객체
     * @return 에러 메시지와 타입을 포함한 JSON 응답 (500 에러)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAllExceptions(Exception ex) {
        ex.printStackTrace(); // 서버 로그에 에러 내역 상세 기록
        
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage()); // 에러 상세 메시지
        body.put("type", ex.getClass().getSimpleName()); // 예외 클래스 종류
        
        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
