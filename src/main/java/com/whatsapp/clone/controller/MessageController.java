package com.whatsapp.clone.controller;

import com.whatsapp.clone.dto.MessageRequest;
import com.whatsapp.clone.model.Message;
import com.whatsapp.clone.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    @Autowired
    private MessageService messageService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Send message via REST fallback
    @PostMapping
    public Message send(@Valid @RequestBody MessageRequest request) {
        Message message = messageService.send(request);
        broadcastMessage(message);
        return message;
    }

    // Edit message
    @PutMapping("/{id}")
    public ResponseEntity<?> editMessage(@PathVariable Long id, @RequestBody Map<String, String> body, Principal principal) {
        String newContent = body.get("content");
        if (newContent == null || newContent.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Content cannot be empty");
        }
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Message message = messageService.editMessage(id, newContent, principal.getName());
            broadcastMessage(message);
            return ResponseEntity.ok(message);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Soft delete message
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long id, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Message message = messageService.deleteMessage(id, principal.getName());
            broadcastMessage(message);
            return ResponseEntity.ok(message);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1-to-1 conversation history
    @GetMapping("/conversation")
    public List<Message> getConversation(@RequestParam String userA, @RequestParam String userB) {
        return messageService.getConversation(userA, userB);
    }

    // Group chat history
    @GetMapping("/group/{groupId}")
    public List<Message> getGroupMessages(@PathVariable Long groupId) {
        return messageService.getGroupMessages(groupId);
    }

    // Read receipts
    @PostMapping("/read")
    public void markRead(@RequestParam String userViewing, @RequestParam String otherUser) {
        messageService.markAsRead(userViewing, otherUser);
    }

    // Helper to broadcast message updates via WebSockets
    private void broadcastMessage(Message msg) {
        if (msg.getGroupId() != null) {
            messagingTemplate.convertAndSend("/topic/group/" + msg.getGroupId(), msg);
        } else if (msg.getReceiver() != null) {
            messagingTemplate.convertAndSendToUser(msg.getReceiver(), "/queue/messages", msg);
            messagingTemplate.convertAndSendToUser(msg.getSender(), "/queue/messages", msg);
        }
    }
}
