package com.whatsapp.clone.repository;

import com.whatsapp.clone.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupRepository extends JpaRepository<Group, Long> {
    List<Group> findByMembersContaining(String username);
}
