package com.example.demo.controller;

import com.example.demo.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final UserAccountRepository accounts;

    public record AccountSummary(Long id, String email, String role, String status, Instant createdAt, Instant recoverUntil) {}

    @GetMapping("/users")
    public List<AccountSummary> users() {
        return accounts.findAll().stream().map(user -> new AccountSummary(
            user.getId(), user.getEmail(), user.getRole(), user.getStatus(), user.getCreatedAt(),
            user.getDeletionRequestedAt() == null ? null : user.getDeletionRequestedAt().plusSeconds(7 * 86400L)
        )).toList();
    }

    @GetMapping("/summary")
    public Map<String, Long> summary() {
        var users = accounts.findAll();
        return Map.of(
            "totalUsers", (long) users.size(),
            "activeUsers", users.stream().filter(user -> "ACTIVE".equals(user.getStatus())).count(),
            "pendingDeletion", users.stream().filter(user -> "PENDING_DELETION".equals(user.getStatus())).count()
        );
    }
}