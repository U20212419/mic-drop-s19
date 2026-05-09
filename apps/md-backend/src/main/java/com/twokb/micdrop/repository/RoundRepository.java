package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;

@Repository
public interface RoundRepository extends JpaRepository<Round, Integer> {

	Optional<Round> findByRoundNumber(Integer roundNumber);

	Optional<Round> findByActiveTrue();

	List<Round> findAllByActiveTrue();

	boolean existsByRoundNumber(Integer roundNumber);

	// Fetch all contestants for a specific round
	@Query(value = """
			SELECT du.* FROM discord_user du
			INNER JOIN user_round ur ON du.id_user = ur.discord_user_id_user
			WHERE ur.round_id_round = :idRound AND ur.user_role = 'contestant'::user_role_type
			""", nativeQuery = true)
	List<DiscordUser> getContestantsByRoundId(@Param("idRound") Integer idRound);

	// Fetch all judges for a specific round
	@Query(value = """
			SELECT du.* FROM discord_user du
			INNER JOIN user_round ur ON du.id_user = ur.discord_user_id_user
			WHERE ur.round_id_round = :idRound AND ur.user_role = 'judge'::user_role_type
			""", nativeQuery = true)
	List<DiscordUser> getJudgesByRoundId(@Param("idRound") Integer idRound);

	// Deactivate all rounds except the one being activated
	@Modifying
	@Query("UPDATE Round r SET r.active = false WHERE r.active = true AND r.idRound != :idRound")
	void deactivateAllRoundsExcept(@Param("idRound") Integer idRound);

}
