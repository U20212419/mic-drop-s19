package com.twokb.micdrop.repository;

import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.DiscordUser;

@Repository
public interface DiscordUserRepository extends JpaRepository<DiscordUser, Integer> {

	Optional<DiscordUser> findByDiscordId(String discordId);

	Optional<DiscordUser> findByUsername(String username);

	boolean existsByDiscordId(String discordId);

	@Query(value = """
			SELECT COUNT(*) > 0 FROM discord_user
			WHERE id_user = :idUser
			AND status = CAST(:statusStr AS contestant_status)
			""", nativeQuery = true)
	boolean existsByIdUserAndStatus(@Param("idUser") Integer idUser, @Param("statusStr") String statusStr);

	@Query(value = """
			SELECT id_user FROM discord_user
			WHERE status = CAST(:statusStr AS contestant_status)
			""", nativeQuery = true)
	Set<Integer> findUserIdsByStatus(@Param("statusStr") String statusStr);

}
