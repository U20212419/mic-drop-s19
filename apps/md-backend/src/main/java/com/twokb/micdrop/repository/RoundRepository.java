package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.Round;

@Repository
public interface RoundRepository extends JpaRepository<Round, Integer> {

	Optional<Round> findByRoundNumber(Integer roundNumber);

	Optional<Round> findByActiveTrue();

	List<Round> findAllByActiveTrue();

	boolean existsByRoundNumber(Integer roundNumber);

	// Deactivate all rounds except the one being activated
	@Modifying
	@Query("UPDATE Round r SET r.active = false WHERE r.active = true AND r.idRound != :idRound")
	void deactivateAllRoundsExcept(@Param("idRound") Integer idRound);

	// Find the most recent round with a round number less than the specified number
	Optional<Round> findFirstByRoundNumberLessThanOrderByRoundNumberDesc(Integer roundNumber);

}
