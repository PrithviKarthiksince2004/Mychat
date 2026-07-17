package com.whatsapp.clone.controller;

import com.whatsapp.clone.dto.GroupRequest;
import com.whatsapp.clone.model.Group;
import com.whatsapp.clone.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    @Autowired
    private GroupService groupService;

    @PostMapping
    public Group createGroup(@Valid @RequestBody GroupRequest request) {
        return groupService.createGroup(request);
    }

    @GetMapping("/{username}")
    public List<Group> getGroupsForUser(@PathVariable String username) {
        return groupService.getGroupsForUser(username);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<?> addMember(@PathVariable Long id, @RequestBody Map<String, String> body, Principal principal) {
        String username = body.get("username");
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username is required");
        }
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Group group = groupService.addMember(id, username, principal.getName());
            return ResponseEntity.ok(group);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}/members/{username}")
    public ResponseEntity<?> removeMember(@PathVariable Long id, @PathVariable String username, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Group group = groupService.removeMember(id, username, principal.getName());
            return ResponseEntity.ok(group);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/rename")
    public ResponseEntity<?> renameGroup(@PathVariable Long id, @RequestBody Map<String, String> body, Principal principal) {
        String groupName = body.get("groupName");
        if (groupName == null || groupName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("GroupName is required");
        }
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Group group = groupService.renameGroup(id, groupName, principal.getName());
            return ResponseEntity.ok(group);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
