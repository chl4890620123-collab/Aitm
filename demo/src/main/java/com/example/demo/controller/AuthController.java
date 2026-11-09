package com.example.demo.controller;

import com.example.demo.entity.UserAccount;
import com.example.demo.service.AccountService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AccountService accounts;

    public record Credentials(String email, String password) {}
    public record UserView(Long id, String email, String role, String status) {}

    public static UserView view(UserAccount account) {
        return new UserView(account.getId(), account.getEmail(), account.getRole(), account.getStatus());
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @PostMapping("/register")
    public ResponseEntity<UserView> register(@RequestBody Credentials body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(view(accounts.register(body.email(), body.password())));
    }

    @GetMapping("/me")
    public UserView me(Authentication authentication) {
        return view(accounts.findByEmail(authentication.getName()));
    }

    @PostMapping("/withdraw")
    public Map<String, String> withdraw(@RequestBody Credentials body, Authentication authentication, HttpServletRequest request) {
        Instant deadline = accounts.requestWithdrawal(authentication.getName(), body.password());
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        return Map.of("recoverUntil", deadline.toString(), "status", "PENDING_DELETION");
    }

    @PostMapping("/restore")
    public Map<String, String> restore(@RequestBody Credentials body) {
        accounts.restore(body.email(), body.password());
        return Map.of("status", "ACTIVE", "message", "탈퇴 철회가 완료되었습니다. 로그인하세요.");
    }
}