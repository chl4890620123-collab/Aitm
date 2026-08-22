package com.example.demo.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class VideoStorageServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void storesAndDeletesVideoInsideConfiguredDirectory() throws Exception {
        VideoStorageService service = new VideoStorageService(tempDir.toString(), 1024 * 1024);
        service.initialize();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.webm",
                "video/webm",
                "fake-video".getBytes()
        );

        VideoStorageService.StoredVideo stored = service.store(file);

        assertTrue(Files.exists(tempDir.resolve(stored.storedFileName())));
        assertTrue(stored.playbackUrl().startsWith("/media/"));
        assertTrue(service.deletePlaybackUrl(stored.playbackUrl()));
        assertFalse(Files.exists(tempDir.resolve(stored.storedFileName())));
    }

    @Test
    void rejectsNonVideoMimeType() throws Exception {
        VideoStorageService service = new VideoStorageService(tempDir.toString(), 1024 * 1024);
        service.initialize();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.mp4",
                "text/plain",
                "not-video".getBytes()
        );

        assertThrows(IllegalArgumentException.class, () -> service.store(file));
    }
}
