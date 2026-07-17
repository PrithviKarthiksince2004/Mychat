package com.whatsapp.clone.controller;

import com.whatsapp.clone.dto.ChatListItem;
import com.whatsapp.clone.model.Group;
import com.whatsapp.clone.model.Message;
import com.whatsapp.clone.model.User;
import com.whatsapp.clone.repository.GroupRepository;
import com.whatsapp.clone.repository.MessageRepository;
import com.whatsapp.clone.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/chats")
public class ChatListController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private MessageRepository messageRepository;

    @GetMapping("/recent")
    public List<ChatListItem> getRecentChats(Principal principal) {
        if (principal == null) {
            return new ArrayList<>();
        }
        String currentUser = principal.getName();
        List<ChatListItem> items = new ArrayList<>();

        // 1. Fetch 1-to-1 chats with messages
        List<User> users = userRepository.findAll();
        for (User u : users) {
            if (u.getUsername().equals(currentUser)) {
                continue;
            }
            List<Message> convo = messageRepository.findConversation(currentUser, u.getUsername());
            Message lastMsg = convo.isEmpty() ? null : convo.get(convo.size() - 1);
            
            // Only show in recent chats if a conversation history exists
            if (lastMsg != null) {
                long unread = messageRepository.findUnreadFrom(currentUser, u.getUsername()).size();
                String preview = lastMsg.isDeleted() ? "This message was deleted" : 
                                (lastMsg.getContent() != null && !lastMsg.getContent().isEmpty() ? lastMsg.getContent() : "Media file");
                
                items.add(new ChatListItem(
                        u.getUsername(),
                        "user",
                        u.getUsername(),
                        u.getProfilePicture(),
                        preview,
                        lastMsg.getTimestamp(),
                        unread,
                        u.isOnline(),
                        u.getLastSeen(),
                        u.getBio()
                ));
            }
        }

        // 2. Fetch groups for this user
        List<Group> groups = groupRepository.findByMembersContaining(currentUser);
        for (Group g : groups) {
            List<Message> groupMsgs = messageRepository.findByGroupIdOrderByTimestampAsc(g.getId());
            Message lastMsg = groupMsgs.isEmpty() ? null : groupMsgs.get(groupMsgs.size() - 1);
            
            String preview = null;
            java.time.LocalDateTime ts = null;
            if (lastMsg != null) {
                preview = lastMsg.isDeleted() ? "This message was deleted" : 
                          (lastMsg.getContent() != null && !lastMsg.getContent().isEmpty() ? lastMsg.getContent() : "Media file");
                ts = lastMsg.getTimestamp();
            }

            items.add(new ChatListItem(
                    String.valueOf(g.getId()),
                    "group",
                    g.getGroupName(),
                    null,
                    preview,
                    ts,
                    0, // group unread calculated client-side
                    false,
                    null,
                    null
            ));
        }

        // Sort by last activity (timestamp) descending
        items.sort((a, b) -> {
            if (a.getLastMessageTimestamp() == null && b.getLastMessageTimestamp() == null) return 0;
            if (a.getLastMessageTimestamp() == null) return 1;
            if (b.getLastMessageTimestamp() == null) return -1;
            return b.getLastMessageTimestamp().compareTo(a.getLastMessageTimestamp());
        });

        return items;
    }
}
