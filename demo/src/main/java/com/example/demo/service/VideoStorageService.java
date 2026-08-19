package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VideoStorageService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm");

    @Value("${restok.video.storage-path:/data/videos}")
    private String storagePath;

    public StoredVideo store(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Video file is empty");
        String originalName = file.getOriginalFilename() == null ? "video.webm" : file.getOriginalFilename();
        String extension = extensionOf(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) throw new IllegalArgumentException("Unsupported video extension");

        Path root = Paths.get(storagePath).toAbsolutePath().normalize();
        Files.createDirectories(root);
        String storedName = UUID.randomUUID() + "." + extension;
        Path target = root.resolve(storedName).normalize();
        if (!target.startsWith(root)) throw new SecurityException("Invalid storage path");
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return new StoredVideo(storedName, file.getSize(), extension, "/data/videos/" + storedName);
    }

    public Resource load(String storedName) throws IOException {
        if (!storedName.matches("[a-fA-F0-9-]+\\.(mp4|mov|avi|webm)")) throw new IllegalArgumentException("Invalid video name");
        Path root = Paths.get(storagePath).toAbsolutePath().normalize();
        Path target = root.resolve(storedName).normalize();
        if (!target.startsWith(root) || !Files.exists(target)) throw new IOException("Video not found");
        return new UrlResource(target.toUri());
    }

    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record StoredVideo(String storedName, long fileSize, String extension, String analysisPath) {}
}
