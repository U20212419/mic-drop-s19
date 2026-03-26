package com.twokb.micdrop.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.Submission;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {

	List<Submission> findByIdContestantAndIdRound(Integer idContestant, Integer idRound);

	List<Submission> findByIdJudgeAndIdRound(Integer idJudge, Integer idRound);

	boolean existsByContestant_User_DiscordId(String discordId);

}
