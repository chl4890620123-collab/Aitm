package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "aitm_users", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Getter
@Setter
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 100)
    private String passwordHash;

    // Only the server can assign ADMIN; self-registration always creates USER.
    @Column(nullable = false, length = 16)
    private String role = "USER";

    @Column(nullable = false, length = 24)
    private String status = "ACTIVE";

    private Instant deletionRequestedAt;
    private Instant createdAt = Instant.now();
}