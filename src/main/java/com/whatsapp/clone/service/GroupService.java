package com.whatsapp.clone.service;

import com.whatsapp.clone.dto.GroupRequest;
import com.whatsapp.clone.model.Group;
import com.whatsapp.clone.repository.GroupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GroupService {

    @Autowired
    private GroupRepository groupRepository;

    public Group createGroup(GroupRequest request) {
        Group group = new Group(request.getGroupName(), request.getCreatedBy());
        if (request.getMembers() != null) {
            group.getMembers().addAll(request.getMembers());
        }
        return groupRepository.save(group);
    }

    public Group addMember(Long groupId, String username, String requester) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (!group.getAdminUsername().equals(requester)) {
            throw new SecurityException("Unauthorized: Only the group admin can add members");
        }
        group.getMembers().add(username);
        return groupRepository.save(group);
    }

    public Group removeMember(Long groupId, String username, String requester) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (!group.getAdminUsername().equals(requester)) {
            throw new SecurityException("Unauthorized: Only the group admin can remove members");
        }
        // Admin cannot be removed unless group is deleted, or they leave
        group.getMembers().remove(username);
        return groupRepository.save(group);
    }

    public Group renameGroup(Long groupId, String newName, String requester) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (!group.getAdminUsername().equals(requester)) {
            throw new SecurityException("Unauthorized: Only the group admin can rename the group");
        }
        group.setGroupName(newName);
        return groupRepository.save(group);
    }

    public List<Group> getGroupsForUser(String username) {
        return groupRepository.findByMembersContaining(username);
    }
}
