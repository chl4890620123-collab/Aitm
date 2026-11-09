package com.example.demo.service;

import com.example.demo.entity.UserAccount;
import com.example.demo.repository.AnalysisResultRepository;
import com.example.demo.repository.AnalysisSessionRepository;
import com.example.demo.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AccountService {
    public static final Duration WITHDRAWAL_GRACE = Duration.ofDays(7);

    private final UserAccountRepository accounts;
    private final AnalysisResultRepository results;
    private final AnalysisSessionRepository sessions;
    private final VideoStorageService videoStorage;
    private final PasswordEncoder passwords;

    @Value("${AITM_ADMIN_EMAIL:}")
    private String bootstrapAdminEmail;

    @Value("${AITM_ADMIN_PASSWORD:}")
    private String bootstrapAdminPassword;

    public UserAccount findByEmail(String email) {
        return accounts.findByEmailIgnoreCase(email).orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    public UserAccount register(String email, String password) {
        String normalized = normalizeEmail(email);
        validatePassword(password);
        if (accounts.findByEmailIgnoreCase(normalized).isPresent()) {
            throw new IllegalArgumentException("이미 등록된 이메일입니다.");
        }
        UserAccount user = new UserAccount();
        user.setEmail(normalized);
        user.setPasswordHash(passwords.encode(password));
        user.setRole("USER");
        user.setStatus("ACTIVE");
        return accounts.save(user);
    }

    @Transactional
    public Instant requestWithdrawal(String email, String password) {
        UserAccount user = findByEmail(email);
        if (!passwords.matches(password == null ? "" : password, user.getPasswordHash())) {
            throw new SecurityException("비밀번호가 올바르지 않습니다.");
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new IllegalArgumentException("이미 탈퇴 대기 중인 계정입니다.");
        }
        user.setStatus("PENDING_DELETION");
        user.setDeletionRequestedAt(Instant.now());
        return user.getDeletionRequestedAt().plus(WITHDRAWAL_GRACE);
    }

    @Transactional
    public void restore(String email, String password) {
        UserAccount user = findByEmail(normalizeEmail(email));
        if (!passwords.matches(password == null ? "" : password, user.getPasswordHash())) {
            throw new SecurityException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        if (!"PENDING_DELETION".equals(user.getStatus()) || user.getDeletionRequestedAt() == null
                || !Instant.now().isBefore(user.getDeletionRequestedAt().plus(WITHDRAWAL_GRACE))) {
            throw new IllegalArgumentException("탈퇴 철회 가능 기간이 아닙니다.");
        }
        user.setStatus("ACTIVE");
        user.setDeletionRequestedAt(null);
    }

    public static String normalizeEmail(String email) {
        String value = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (!value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") || value.length() > 254) {
            throw new IllegalArgumentException("올바른 이메일 주소를 입력하세요.");
        }
        return value;
    }

    public static void validatePassword(String password) {
        if (password == null || password.length() < 10 || password.length() > 128) {
            throw new IllegalArgumentException("비밀번호는 10~128자로 입력하세요.");
        }
    }

    // Environment-only initial admin; never grant admin role through registration or client input.
    @EventListener(ApplicationReadyEvent.class)
    public void createInitialAdmin() {
        if (bootstrapAdminEmail.isBlank() && bootstrapAdminPassword.isBlank()) return;
        if (bootstrapAdminEmail.isBlank() || bootstrapAdminPassword.isBlank()) {
            throw new IllegalStateException("AITM_ADMIN_EMAIL과 AITM_ADMIN_PASSWORD를 함께 설정하세요.");
        }
        String email = normalizeEmail(bootstrapAdminEmail);
        validatePassword(bootstrapAdminPassword);
        var existing = accounts.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            if (!"ADMIN".equals(existing.get().getRole())) {
                throw new IllegalStateException("초기 관리자 이메일이 기존 일반 회원과 중복됩니다.");
            }
            return;
        }
        UserAccount admin = new UserAccount();
        admin.setEmail(email);
        admin.setPasswordHash(passwords.encode(bootstrapAdminPassword));
        admin.setRole("ADMIN");
        admin.setStatus("ACTIVE");
        accounts.save(admin);
    }

    // Entries remain restorable for exactly seven days. Purge their records and
    // stored videos on the first hourly cleanup after that period ends.
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void purgeExpiredWithdrawals() {
        var expired = accounts.findByStatusAndDeletionRequestedAtLessThanEqual(
            "PENDING_DELETION", Instant.now().minus(WITHDRAWAL_GRACE));
        for (var account : expired) {
            String ownerId = account.getId().toString();
            var owned = results.findBySession_UserIdOrderByResultIdDesc(ownerId);
            for (var result : owned) {
                videoStorage.deletePlaybackUrl(result.getVideoUrl());
            }
            results.deleteAll(owned);
            results.flush();
            sessions.deleteAll(sessions.findByUserIdOrderByCreatedAtDesc(ownerId));
            accounts.delete(account);
        }
    }
}