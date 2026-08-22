package com.example.demo.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class VideoStorageService {
    private static final Logger log = LoggerFactory.getLogger(VideoStorageService.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm", "mkv");

    private final Path videoDirectory;
    private final long maxFileSizeBytes;

    public VideoStorageService(
            @Value("${aitm.storage.video-dir:./data/videos}") String videoDirectory,
            @Value("${aitm.storage.max-file-size-bytes:524288000}") long maxFileSizeBytes
    ) {
        this.videoDirectory = Path.of(videoDirectory).toAbsolutePath().normalize();
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @PostConstruct
    public void initialize() throws IOException {
        Files.createDirectories(videoDirectory);
    }

    public StoredVideo store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("분석할 영상 파일이 비어 있습니다.");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new IllegalArgumentException("영상 파일은 500MB 이하만 업로드할 수 있습니다.");
        }

        String contentType = file.getContentType();
        if (contentType != null
                && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")
                && !"application/octet-stream".equalsIgnoreCase(contentType)) {
            throw new IllegalArgumentException("영상 MIME 형식만 업로드할 수 있습니다.");
        }

        String extension = extractExtension(file.getOriginalFilename(), contentType);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("지원하지 않는 영상 형식입니다: " + extension);
        }

        String storedFileName = UUID.randomUUID() + "." + extension;
        Path target = videoDirectory.resolve(storedFileName).normalize();
        if (!target.startsWith(videoDirectory)) {
            throw new SecurityException("잘못된 저장 경로입니다.");
        }

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new IllegalStateException("영상을 저장하지 못했습니다.", ex);
        }

        return new StoredVideo(
                storedFileName,
                target.toUri().toString(),
                "/media/" + storedFileName,
                file.getSize(),
                extension
        );
    }

    public boolean deletePlaybackUrl(String playbackUrl) {
        if (playbackUrl == null || !playbackUrl.startsWith("/media/")) {
            return false;
        }

        String fileName = playbackUrl.substring("/media/".length());
        if (fileName.isBlank() || fileName.contains("/") || fileName.contains("\\")) {
            return false;
        }

        Path target = videoDirectory.resolve(fileName).normalize();
        if (!target.startsWith(videoDirectory)) {
            return false;
        }

        try {
            return Files.deleteIfExists(target);
        } catch (IOException ex) {
            log.warn("Failed to delete stored video: {}", target, ex);
            return false;
        }
    }

    private String extractExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) {
                return originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
            }
        }
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("webm")) {
            return "webm";
        }
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("quicktime")) {
            return "mov";
        }
        return "mp4";
    }

    public record StoredVideo(
            String storedFileName,
            String analysisUri,
            String playbackUrl,
            long size,
            String extension
    ) {
    }
}
