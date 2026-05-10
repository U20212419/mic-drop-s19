package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.DiscordUser;
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

	@Query(value = """
			SELECT ur.discord_user_id_user FROM user_round ur
			JOIN discord_user du ON ur.discord_user_id_user = du.id_user
			JOIN round r ON ur.round_id_round = r.id_round
			WHERE r.round_number = :roundNumber
			AND ur.user_role = CAST(:userRoleStr AS user_role_type)
			AND du.status = CAST(:statusStr AS contestant_status)
			""", nativeQuery = true)
	Set<Integer> findUserIdsByRound_RoundNumberAndUserRoleAndUserStatus(@Param("roundNumber") Integer roundNumber, @Param("userRoleStr") String userRoleStr, @Param("statusStr") String statusStr);

	List<UserRound> findByRound_RoundNumberAndUserRole(Integer roundNumber, UserRoleType userRole);

	Optional<UserRound> findById_UserIdAndRound_RoundNumber(Integer idUser, Integer roundNumber);

	@Query(value = """
			SELECT discord_user_id_user FROM user_round
			WHERE round_id_round = :idRound
			AND user_role = CAST(:userRoleStr AS user_role_type)
			""", nativeQuery = true)
	Set<Integer> findUserIdsByRoundAndRole(@Param("idRound") Integer idRound, @Param("userRoleStr") String userRoleStr);

	List<UserRound> findById_RoundIdAndId_UserIdIn(Integer idRound, Set<Integer> userIds);

	// Fetch the full UserRound entities to compare group numbers
    @Query(value = """
            SELECT ur.* FROM user_round ur 
            WHERE ur.round_id_round = :idRound 
            AND ur.user_role = CAST(:userRoleStr AS user_role_type)
            """, nativeQuery = true)
    List<UserRound> findByRoundIdAndRole(
            @Param("idRound") Integer idRound, 
            @Param("userRoleStr") String userRoleStr
    );

	@Query(value = """
			SELECT du.* FROM discord_user du
			JOIN user_round ur ON du.id_user = ur.discord_user_id_user
			WHERE ur.round_id_round = :idRound
			AND ur.user_role = CAST(:userRoleStr AS user_role_type)
			""", nativeQuery = true)
	List<DiscordUser> findUsersByRoundAndRole(@Param("idRound") Integer idRound, @Param("userRoleStr") String userRoleStr);
}
