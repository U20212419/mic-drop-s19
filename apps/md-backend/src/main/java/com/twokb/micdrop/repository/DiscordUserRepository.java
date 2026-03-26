package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;

@Repository
public interface DiscordUserRepository extends JpaRepository<DiscordUser, Integer> {

	Optional<DiscordUser> findByDiscordId(String discordId);

	Optional<DiscordUser> findByUsername(String username);

	List<DiscordUser> findByStatus(ContestantStatus status);

	boolean existsByDiscordId(String discordId);

}
