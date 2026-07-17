package com.whatsapp.clone.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
public class Message {

    public enum Status { SENT, DELIVERED, READ }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sender;

    private String receiver;

    private Long groupId;

    @Column(length = 2000)
    private String content;

    private LocalDateTime timestamp;

    @Enumerated(EnumType.STRING)
    private Status status = Status.SENT;

    // Media fields
    private String fileUrl;
    private String fileName;
    private String fileType;
    private Long fileSize;

    // Phase 5 features
    private boolean deleted = false;
    private boolean edited = false;
    private Long parentMessageId;
    private String parentMessageSender;
    private String parentMessageContent;

    public Message() {}

    public Message(String sender, String receiver, Long groupId, String content) {
        this.sender = sender;
        this.receiver = receiver;
        this.groupId = groupId;
        this.timestamp = LocalDateTime.now();
        this.content = content;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }

    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }

    public Long getParentMessageId() { return parentMessageId; }
    public void setParentMessageId(Long parentMessageId) { this.parentMessageId = parentMessageId; }

    public String getParentMessageSender() { return parentMessageSender; }
    public void setParentMessageSender(String parentMessageSender) { this.parentMessageSender = parentMessageSender; }

    public String getParentMessageContent() { return parentMessageContent; }
    public void setParentMessageContent(String parentMessageContent) { this.parentMessageContent = parentMessageContent; }
}
