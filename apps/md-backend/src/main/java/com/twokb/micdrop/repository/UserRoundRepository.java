package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.model.UserRoundId;

@Repository
public interface UserRoundRepository extends JpaRepository<UserRound, UserRoundId> {

	List<UserRound> findById_RoundId(Integer idRound);

	List<UserRound> findById_UserId(Integer idUser);

	List<UserRound> findByRound_RoundNumber(Integer roundNumber);

	@Query("SELECT ur.id.userId FROM UserRound ur WHERE ur.round.roundNumber = :roundNumber")
	Set<Integer> findUserIdsByRound_RoundNumber(@Param("roundNumber") Integer roundNumber);

	List<UserRound> findByRound_RoundNumberAndUserRole(Integer roundNumber, UserRoleType userRole);

	Optional<UserRound> findById_UserIdAndRound_RoundNumber(Integer idUser, Integer roundNumber);

	@Query(value = """
			SELECT discord_user_id_user FROM user_round
			WHERE round_id_round = :idRound
			AND user_role = CAST(:userRoleStr AS user_role_type)
			""", nativeQuery = true)
	Set<Integer> findUserIdsByRoundAndRole(@Param("idRound") Integer idRound, @Param("userRoleStr") String userRoleStr);

}
