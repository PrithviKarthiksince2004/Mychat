package com.whatsapp.clone.controller;

import com.whatsapp.clone.model.User;
import com.whatsapp.clone.service.FileStorageService;
import com.whatsapp.clone.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private FileStorageService fileStorageService;

    // Contact list
    @GetMapping
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    // Update profile bio and picture
    @PutMapping("/{username}/profile")
    public ResponseEntity<?> updateProfile(
            @PathVariable String username,
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        try {
            String profilePictureFilename = null;
            if (file != null && !file.isEmpty()) {
                // Validate file type (e.g. image only)
                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) {
                    return ResponseEntity.badRequest().body("Profile picture must be an image");
                }
                profilePictureFilename = fileStorageService.storeFile(file);
            }
            User updatedUser = userService.updateProfile(username, bio, profilePictureFilename);
            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
