package com.whatsapp.clone.repository;

import com.whatsapp.clone.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // 1-to-1 chat history between two users, both directions, oldest first
    @Query("SELECT m FROM Message m WHERE m.groupId IS NULL AND " +
           "((m.sender = :userA AND m.receiver = :userB) OR (m.sender = :userB AND m.receiver = :userA)) " +
           "ORDER BY m.timestamp ASC")
    List<Message> findConversation(@Param("userA") String userA, @Param("userB") String userB);

    // Group chat history
    List<Message> findByGroupIdOrderByTimestampAsc(Long groupId);

    // Messages sent by someone else to this user that are not yet read (for badge counts / read receipts)
    @Query("SELECT m FROM Message m WHERE m.receiver = :user AND m.sender = :otherUser AND m.status <> 'READ'")
    List<Message> findUnreadFrom(@Param("user") String user, @Param("otherUser") String otherUser);

    List<Message> findByReceiverAndStatus(String receiver, Message.Status status);
}
