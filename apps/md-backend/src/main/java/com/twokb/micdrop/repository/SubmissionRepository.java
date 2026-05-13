package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.Submission;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {

	List<Submission> findByIdRound(Integer idRound);

	List<Submission> findByIdContestantAndIdRound(Integer idContestant, Integer idRound);

	List<Submission> findByIdJudgeAndIdRound(Integer idJudge, Integer idRound);

	boolean existsByContestant_User_DiscordId(String discordId);

	Optional<Submission> findByIdRoundAndIdContestantAndIdJudge(Integer idRound, Integer idContestant, Integer idJudge);

	List<Submission> findByIdRoundAndIdContestantAndIdJudgeIn(Integer idRound, Integer idContestant,
			List<Integer> idJudges);

	List<Submission> findByIdRoundAndIdJudgeOrderByIdSubmissionAsc(Integer idRound, Integer idJudge);

}
