package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.twokb.micdrop.model.Submission;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {

	List<Submission> findByIdRound(Integer idRound);

	List<Submission> findByIdContestantAndIdRound(Integer idContestant, Integer idRound);

	List<Submission> findByIdJudgeAndIdRound(Integer idJudge, Integer idRound);

	boolean existsByContestant_DiscordId(String discordId);

	Optional<Submission> findByIdRoundAndIdContestantAndIdJudge(Integer idRound, Integer idContestant, Integer idJudge);

	List<Submission> findByIdRoundAndIdContestantAndIdJudgeIn(Integer idRound, Integer idContestant,
			List<Integer> idJudges);

	List<Submission> findByIdRoundAndIdJudgeOrderByIdSubmissionAsc(Integer idRound, Integer idJudge);

	@Query("""
			SELECT COUNT(s) FROM Submission s
			WHERE s.idRound = :idRound
			AND s.idJudge = :idJudge
			AND s.score IS NULL
			AND (s.subLink IS NOT NULL AND TRIM(s.subLink) <> '')
			""")
	long countPendingJudgeSubmissions(Integer idRound, Integer idJudge);

	@Query("""
			SELECT COUNT(s) FROM Submission s
			WHERE s.idRound = :idRound
			AND s.idContestant = :idContestant
			AND s.subLink IS NOT NULL
			AND TRIM(s.subLink) <> ''
			""")
	long countSubmittedSongs(@Param("idRound") Integer idRound, @Param("idContestant") Integer idContestant);

	Optional<Submission> findFirstByIdContestantAndSubLink(Integer idContestant, String subLink);

	Optional<Submission> findFirstBySubLink(String subLink);

	List<Submission> findByIdRoundAndIdContestantIn(Integer idRound, List<Integer> idContestants);

	@Query("""
			SELECT s FROM Submission s
			WHERE s.score IS NOT NULL
			""")
	List<Submission> findAllByScoreIsNotNull();

	boolean existsByIdJudgeAndSubLink(Integer idJudge, String subLink);

}
