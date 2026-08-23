package com.example.demo.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseCharsetMigration implements CommandLineRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public DatabaseCharsetMigration(DataSource dataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName();
            if (product == null || !product.toLowerCase().contains("mariadb")) {
                return;
            }
        }

        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        if (database == null || !database.matches("[A-Za-z0-9_]+")) {
            throw new IllegalStateException("Unexpected MariaDB database name");
        }

        jdbcTemplate.execute("ALTER DATABASE `" + database + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM information_schema.TABLES " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' " +
                        "AND (TABLE_COLLATION IS NULL OR TABLE_COLLATION NOT LIKE 'utf8mb4%')",
                String.class
        );

        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=0");
        try {
            for (String table : tables) {
                if (!table.matches("[A-Za-z0-9_]+")) {
                    throw new IllegalStateException("Unexpected MariaDB table name");
                }
                jdbcTemplate.execute("ALTER TABLE `" + table + "` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            }
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=1");
        }
    }
}
