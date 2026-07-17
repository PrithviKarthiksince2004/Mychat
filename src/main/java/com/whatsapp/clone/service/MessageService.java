package com.whatsapp.clone.service;

import com.whatsapp.clone.dto.MessageRequest;
import com.whatsapp.clone.model.Message;
import com.whatsapp.clone.model.User;
import com.whatsapp.clone.repository.MessageRepository;
import com.whatsapp.clone.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public Message send(MessageRequest request) {
        Message message = new Message(
                request.getSender(),
                request.getReceiver(),
                request.getGroupId(),
                request.getContent()
        );

        message.setFileUrl(request.getFileUrl());
        message.setFileName(request.getFileName());
        message.setFileType(request.getFileType());
        message.setFileSize(request.getFileSize());

        // Check if receiver is online to mark as DELIVERED
        if (request.getReceiver() != null) {
            boolean isOnline = userRepository.findByUsername(request.getReceiver())
                    .map(User::isOnline)
                    .orElse(false);
            if (isOnline) {
                message.setStatus(Message.Status.DELIVERED);
            }
        }

        if (request.getParentMessageId() != null) {
            messageRepository.findById(request.getParentMessageId()).ifPresent(parent -> {
                message.setParentMessageId(parent.getId());
                message.setParentMessageSender(parent.getSender());
                if (parent.isDeleted()) {
                    message.setParentMessageContent("This message was deleted");
                } else {
                    message.setParentMessageContent(parent.getContent() != null ? parent.getContent() : "Media file");
                }
            });
        }

        return messageRepository.save(message);
    }

    public void deliverPendingMessages(String receiver) {
        List<Message> pending = messageRepository.findByReceiverAndStatus(receiver, Message.Status.SENT);
        for (Message m : pending) {
            m.setStatus(Message.Status.DELIVERED);
            // Notify the sender
            messagingTemplate.convertAndSendToUser(m.getSender(), "/queue/messages", m);
            // Notify the receiver to sync their UI
            messagingTemplate.convertAndSendToUser(m.getReceiver(), "/queue/messages", m);
        }
        messageRepository.saveAll(pending);
    }

    public Message deleteMessage(Long messageId, String requester) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!message.getSender().equals(requester)) {
            throw new SecurityException("Unauthorized: You can only delete your own messages");
        }
        message.setDeleted(true);
        message.setContent("This message was deleted");
        message.setFileUrl(null);
        message.setFileName(null);
        message.setFileType(null);
        message.setFileSize(null);
        return messageRepository.save(message);
    }

    public Message editMessage(Long messageId, String newContent, String requester) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!message.getSender().equals(requester)) {
            throw new SecurityException("Unauthorized: You can only edit your own messages");
        }
        if (message.isDeleted()) {
            throw new IllegalArgumentException("Cannot edit a deleted message");
        }
        message.setContent(newContent);
        message.setEdited(true);
        return messageRepository.save(message);
    }

    public List<Message> getConversation(String userA, String userB) {
        return messageRepository.findConversation(userA, userB);
    }

    public List<Message> getGroupMessages(Long groupId) {
        return messageRepository.findByGroupIdOrderByTimestampAsc(groupId);
    }

    public void markAsRead(String userViewing, String otherUser) {
        List<Message> unread = messageRepository.findUnreadFrom(userViewing, otherUser);
        for (Message m : unread) {
            m.setStatus(Message.Status.READ);
            // Notify sender & receiver of the read status change
            messagingTemplate.convertAndSendToUser(m.getSender(), "/queue/messages", m);
            messagingTemplate.convertAndSendToUser(m.getReceiver(), "/queue/messages", m);
        }
        messageRepository.saveAll(unread);
    }
}
