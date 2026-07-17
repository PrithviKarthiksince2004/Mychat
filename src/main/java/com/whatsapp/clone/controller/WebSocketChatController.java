package com.whatsapp.clone.controller;

import com.whatsapp.clone.dto.MessageRequest;
import com.whatsapp.clone.model.Message;
import com.whatsapp.clone.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class WebSocketChatController {

    @Autowired
    private MessageService messageService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat")
    public void handleChatMessage(MessageRequest request, Principal principal) {
        if (principal != null) {
            request.setSender(principal.getName());
        }

        Message savedMessage = messageService.send(request);

        if (savedMessage.getGroupId() != null) {
            messagingTemplate.convertAndSend("/topic/group/" + savedMessage.getGroupId(), savedMessage);
        } else if (savedMessage.getReceiver() != null) {
            messagingTemplate.convertAndSendToUser(savedMessage.getReceiver(), "/queue/messages", savedMessage);
            messagingTemplate.convertAndSendToUser(savedMessage.getSender(), "/queue/messages", savedMessage);
        }
    }

    @MessageMapping("/typing")
    public void handleTypingIndicator(Map<String, Object> payload, Principal principal) {
        if (principal != null) {
            payload.put("sender", principal.getName());
        }

        String chatType = (String) payload.get("chatType");
        String target = String.valueOf(payload.get("target"));

        if ("group".equals(chatType)) {
            // Broadcast typing indicator to the group topic
            messagingTemplate.convertAndSend("/topic/group/" + target + "/typing", payload);
        } else {
            // Send typing indicator directly to the specific user's queue
            messagingTemplate.convertAndSendToUser(target, "/queue/typing", payload);
        }
    }
}
