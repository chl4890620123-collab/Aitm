package com.example.demo.config;

import com.example.demo.repository.UserAccountRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import java.nio.charset.StandardCharsets;

@Configuration
public class AccountSecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    UserDetailsService userDetailsService(UserAccountRepository accounts) {
        return email -> {
            var account = accounts.findByEmailIgnoreCase(email.trim())
                    .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
            return User.withUsername(account.getEmail())
                    .password(account.getPasswordHash())
                    .roles(account.getRole())
                    .disabled(!"ACTIVE".equals(account.getStatus()))
                    .build();
        };
    }

    @Bean
    SecurityFilterChain accountSecurity(HttpSecurity http, UserAccountRepository accounts) throws Exception {
        http
            .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/csrf", "/api/auth/register", "/api/auth/restore", "/api/auth/login").permitAll()
                // Python coaching reads these reference datasets; only admins may MODIFY them.
                .requestMatchers(HttpMethod.GET, "/api/standards/**", "/api/knowledge/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/standards/**", "/api/knowledge/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/standards/**", "/api/knowledge/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/standards/**", "/api/knowledge/**").hasRole("ADMIN")
                .requestMatchers("/api/**", "/media/**").authenticated()
                .anyRequest().permitAll()
            )
            .formLogin(login -> login
                .loginProcessingUrl("/api/auth/login")
                .successHandler((request, response, auth) -> {
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.getWriter().write("{\"authenticated\":true}");
                })
                .failureHandler((request, response, ex) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.getWriter().write("{\"message\":\"이메일 또는 비밀번호가 올바르지 않거나 계정이 탈퇴 대기 중입니다.\"}");
                })
                .permitAll()
            )
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, auth) -> {
                    response.setStatus(HttpServletResponse.SC_OK);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write("{\"loggedOut\":true}");
                }))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, error) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write("{\"message\":\"로그인이 필요합니다.\"}");
                })
                .accessDeniedHandler((request, response, error) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write("{\"message\":\"접근 권한이 없습니다.\"}");
                })
            )
            .addFilterAfter(new ActiveAccountFilter(accounts), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}