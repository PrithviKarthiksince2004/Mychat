package com.whatsapp.clone.controller;

import com.whatsapp.clone.service.FileStorageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    @Autowired
    private FileStorageService fileStorageService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }

        // Validate size (max 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest().body("File size exceeds 10MB limit");
        }

        // Validate content type (only images and PDFs)
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.startsWith("image/") && !contentType.equals("application/pdf"))) {
            return ResponseEntity.badRequest().body("Only images and PDFs are allowed");
        }

        try {
            String fileName = fileStorageService.storeFile(file);
            String fileUrl = "/api/media/download/" + fileName;

            return ResponseEntity.ok(Map.of(
                    "fileUrl", fileUrl,
                    "fileName", file.getOriginalFilename() != null ? file.getOriginalFilename() : fileName,
                    "fileType", contentType,
                    "fileSize", file.getSize()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Could not upload file: " + e.getMessage());
        }
    }

    @GetMapping("/download/{filename:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename, HttpServletRequest request) {
        Resource resource = fileStorageService.loadFileAsResource(filename);

        String contentType = null;
        try {
            contentType = request.getServletContext().getMimeType(resource.getFile().getAbsolutePath());
        } catch (IOException ex) {
            // Fallback content type
        }

        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
