package com.whatsapp.clone.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "chat_groups")
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String groupName;

    private String createdBy;

    private String adminUsername;

    @ElementCollection
    @CollectionTable(name = "group_members", joinColumns = @JoinColumn(name = "group_id"))
    @Column(name = "username")
    private Set<String> members = new HashSet<>();

    public Group() {}

    public Group(String groupName, String createdBy) {
        this.groupName = groupName;
        this.createdBy = createdBy;
        this.adminUsername = createdBy;
        this.members.add(createdBy);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getAdminUsername() { return adminUsername; }
    public void setAdminUsername(String adminUsername) { this.adminUsername = adminUsername; }

    public Set<String> getMembers() { return members; }
    public void setMembers(Set<String> members) { this.members = members; }
}
