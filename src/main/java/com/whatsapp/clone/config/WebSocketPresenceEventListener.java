package com.whatsapp.clone.config;

import com.whatsapp.clone.service.MessageService;
import com.whatsapp.clone.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Map;

@Component
public class WebSocketPresenceEventListener {

    @Autowired
    private UserService userService;

    @Autowired
    private MessageService messageService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        Principal principal = event.getUser();
        if (principal != null) {
            String username = principal.getName();
            userService.setOnlineStatus(username, true);
            
            // Deliver any pending (SENT) messages to this user
            messageService.deliverPendingMessages(username);
            
            messagingTemplate.convertAndSend("/topic/presence", Map.of(
                    "username", username,
                    "online", true,
                    "lastSeen", LocalDateTime.now().toString()
            ));
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        Principal principal = event.getUser();
        if (principal != null) {
            String username = principal.getName();
            userService.setOnlineStatus(username, false);
            
            messagingTemplate.convertAndSend("/topic/presence", Map.of(
                    "username", username,
                    "online", false,
                    "lastSeen", LocalDateTime.now().toString()
            ));
        }
    }
}
