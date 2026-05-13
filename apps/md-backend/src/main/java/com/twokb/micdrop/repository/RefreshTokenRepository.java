package com.twokb.micdrop.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {

	void deleteByDiscordId(String discordId);

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	Optional<RefreshToken> findByDiscordId(String discordId);

}
