package com.whatsapp.clone.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Set;

public class GroupRequest {
    @NotBlank
    private String groupName;

    @NotBlank
    private String createdBy;

    private Set<String> members; // usernames to add besides the creator

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Set<String> getMembers() { return members; }
    public void setMembers(Set<String> members) { this.members = members; }
}
