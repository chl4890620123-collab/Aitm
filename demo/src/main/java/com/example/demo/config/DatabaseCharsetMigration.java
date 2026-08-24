package com.example.demo.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseCharsetMigration implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DatabaseCharsetMigration.class);
    private static final String TARGET_COLLATION = "utf8mb4_unicode_ci";
    private static final String IDENTIFIER_PATTERN = "[A-Za-z0-9_]+";

    private final DataSource dataSource;
    private final boolean enabled;
    private final int lockWaitSeconds;

    public DatabaseCharsetMigration(
            DataSource dataSource,
            @Value("${app.database.charset-migration.enabled:true}") boolean enabled,
            @Value("${app.database.charset-migration.lock-wait-seconds:10}") int lockWaitSeconds
    ) {
        this.dataSource = dataSource;
        this.enabled = enabled;
        this.lockWaitSeconds = Math.max(1, lockWaitSeconds);
    }

    @Override
    public void run(String... args) throws Exception {
        if (!enabled) {
            log.info("Database charset migration is disabled");
            return;
        }

        try (Connection connection = dataSource.getConnection()) {
            if (!isMariaDb(connection)) {
                return;
            }

            String database = currentDatabase(connection);
            validateIdentifier(database, "database");

            String databaseCollation = currentDatabaseCollation(connection, database);
            List<String> tables = nonUtf8mb4Tables(connection, database);

            if (TARGET_COLLATION.equalsIgnoreCase(databaseCollation) && tables.isEmpty()) {
                log.info("Database charset migration is already complete for {}", database);
                return;
            }

            if (!TARGET_COLLATION.equalsIgnoreCase(databaseCollation)) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("ALTER DATABASE `" + database + "` CHARACTER SET utf8mb4 COLLATE " + TARGET_COLLATION);
                }
                log.info("Updated database {} default collation to {}", database, TARGET_COLLATION);
            }

            if (tables.isEmpty()) {
                return;
            }

            migrateTablesOnSameConnection(connection, tables);
            log.info("Converted {} table(s) to utf8mb4", tables.size());
        }
    }

    private boolean isMariaDb(Connection connection) throws Exception {
        String product = connection.getMetaData().getDatabaseProductName();
        return product != null && product.toLowerCase().contains("mariadb");
    }

    private String currentDatabase(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT DATABASE()")) {
            if (!resultSet.next() || resultSet.getString(1) == null) {
                throw new IllegalStateException("No MariaDB database is selected");
            }
            return resultSet.getString(1);
        }
    }

    private String currentDatabaseCollation(Connection connection, String database) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?")) {
            statement.setString(1, database);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("Unable to read MariaDB database collation");
                }
                return resultSet.getString(1);
            }
        }
    }

    private List<String> nonUtf8mb4Tables(Connection connection, String database) throws Exception {
        List<String> tables = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT TABLE_NAME FROM information_schema.TABLES " +
                        "WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' " +
                        "AND (TABLE_COLLATION IS NULL OR TABLE_COLLATION NOT LIKE 'utf8mb4%') " +
                        "ORDER BY TABLE_NAME")) {
            statement.setString(1, database);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    String table = resultSet.getString(1);
                    validateIdentifier(table, "table");
                    tables.add(table);
                }
            }
        }
        return tables;
    }

    private void migrateTablesOnSameConnection(Connection connection, List<String> tables) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET SESSION FOREIGN_KEY_CHECKS=0");
            try {
                for (String table : tables) {
                    log.info("Converting table {} to utf8mb4", table);
                    statement.execute(
                            "ALTER TABLE `" + table + "` WAIT " + lockWaitSeconds +
                                    " CONVERT TO CHARACTER SET utf8mb4 COLLATE " + TARGET_COLLATION
                    );
                }
            } finally {
                statement.execute("SET SESSION FOREIGN_KEY_CHECKS=1");
            }
        }
    }

    private void validateIdentifier(String value, String type) {
        if (value == null || !value.matches(IDENTIFIER_PATTERN)) {
            throw new IllegalStateException("Unexpected MariaDB " + type + " name");
        }
    }
}
