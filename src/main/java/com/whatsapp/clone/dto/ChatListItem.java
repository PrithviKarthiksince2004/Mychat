package com.whatsapp.clone.dto;

import java.time.LocalDateTime;

public class ChatListItem {
    private String id;
    private String type; // "user" or "group"
    private String name;
    private String avatar;
    private String lastMessage;
    private LocalDateTime lastMessageTimestamp;
    private long unreadCount;
    private boolean online;
    private LocalDateTime lastSeen;
    private String bio;

    public ChatListItem() {}

    public ChatListItem(String id, String type, String name, String avatar, String lastMessage, 
                        LocalDateTime lastMessageTimestamp, long unreadCount, boolean online, 
                        LocalDateTime lastSeen, String bio) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.avatar = avatar;
        this.lastMessage = lastMessage;
        this.lastMessageTimestamp = lastMessageTimestamp;
        this.unreadCount = unreadCount;
        this.online = online;
        this.lastSeen = lastSeen;
        this.bio = bio;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public LocalDateTime getLastMessageTimestamp() { return lastMessageTimestamp; }
    public void setLastMessageTimestamp(LocalDateTime lastMessageTimestamp) { this.lastMessageTimestamp = lastMessageTimestamp; }

    public long getUnreadCount() { return unreadCount; }
    public void setUnreadCount(long unreadCount) { this.unreadCount = unreadCount; }

    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }

    public LocalDateTime getLastSeen() { return lastSeen; }
    public void setLastSeen(LocalDateTime lastSeen) { this.lastSeen = lastSeen; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
}
