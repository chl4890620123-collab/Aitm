package com.example.demo.controller;

import com.example.demo.service.VideoStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {
    private final VideoStorageService storageService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(@RequestPart("file") MultipartFile file) throws IOException {
        var stored = storageService.store(file);
        return ResponseEntity.ok(Map.of(
                "storedName", stored.storedName(),
                "videoUrl", stored.analysisPath(),
                "playbackUrl", "/api/videos/" + stored.storedName() + "?signature=" + storageService.sign(stored.storedName()),
                "fileSize", stored.fileSize(),
                "fileExtension", stored.extension()
        ));
    }

    @GetMapping("/{storedName}")
    public ResponseEntity<Resource> playback(@PathVariable String storedName, @RequestParam String signature) throws IOException {
        if (!storageService.hasValidSignature(storedName, signature)) {
            return ResponseEntity.status(403).build();
        }
        Resource resource = storageService.load(storedName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + storedName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }
}
