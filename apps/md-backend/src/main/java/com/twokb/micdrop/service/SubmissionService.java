package com.twokb.micdrop.service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.repository.SubmissionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SubmissionService {

	private final SubmissionRepository submissionRepository;

	@Transactional(readOnly = true)
	public Submission getById(Integer id) {
		return submissionRepository.findById(id)
			.orElseThrow(() -> new IllegalArgumentException("Submission with ID " + id + " not found."));
	}

	@Transactional(readOnly = true)
	public List<Submission> getByIds(Set<Integer> ids) {
		return submissionRepository.findAllById(ids);
	}

	@Transactional
	public Submission saveSubmission(Submission submission) {
		return submissionRepository.save(submission);
	}

	@Transactional(readOnly = true)
	public List<Submission> getSubmissionsByRoundId(Integer idRound) {
		return submissionRepository.findByIdRound(idRound);
	}

	@Transactional(readOnly = true)
	public List<Submission> getSubmissionsByRoundIdAndContestantIds(Integer idRound, List<Integer> idContestants) {
		return submissionRepository.findByIdRoundAndIdContestantIn(idRound, idContestants);
	}

	@Transactional(readOnly = true)
	public boolean hasSubmissions(String discordId) {
		return submissionRepository.existsByContestant_DiscordId(discordId);
	}

	@Transactional(readOnly = true)
	public Optional<Submission> getByRoundIdAndContestantIdAndJudgeId(Integer idRound, Integer idContestant,
			Integer idJudge) {
		return submissionRepository.findByIdRoundAndIdContestantAndIdJudge(idRound, idContestant, idJudge);
	}

	@Transactional(readOnly = true)
	public List<Submission> getByRoundIdAndContestantIdAndJudgeIds(Integer idRound, Integer idContestant,
			List<Integer> idJudges) {
		return submissionRepository.findByIdRoundAndIdContestantAndIdJudgeIn(idRound, idContestant, idJudges);
	}

	@Transactional(readOnly = true)
	public List<Submission> getJudgeSubmissionsOrderedAsc(Integer idRound, Integer idJudge) {
		return submissionRepository.findByIdRoundAndIdJudgeOrderByIdSubmissionAsc(idRound, idJudge);
	}

	@Transactional(readOnly = true)
	public long countPendingJudgeSubmissions(Integer idRound, Integer idJudge) {
		return submissionRepository.countByIdRoundAndIdJudgeAndScoreIsNull(idRound, idJudge);
	}

	@Transactional(readOnly = true)
	public long countSubmittedSongs(Integer idRound, Integer idContestant) {
		return submissionRepository.countSubmittedSongs(idRound, idContestant);
	}

	@Transactional
	public Submission adminUpdateSubmission(Integer idSubmission, String subLink, String title, String artist) {
		Submission sub = getById(idSubmission);

		sub.setSubLink(subLink);
		sub.setTitle(title);
		sub.setArtist(artist);

		// If the staff removes the link from a submission, the score and review should be
		// cleared as well
		if (subLink == null || subLink.isBlank()) {
			sub.setScore(null);
			sub.setReview(null);
		}

		return submissionRepository.save(sub);
	}

	@Transactional(readOnly = true)
	public Optional<Submission> getSubmissionByContestantAndSubLink(Integer idContestant, String subLink) {
		return submissionRepository.findFirstByIdContestantAndSubLink(idContestant, subLink);
	}

	@Transactional(readOnly = true)
	public Optional<Submission> getSubmissionBySubLink(String subLink) {
		return submissionRepository.findFirstBySubLink(subLink);
	}

	@Transactional(readOnly = true)
	public List<Submission> getAllScoredSubmissions() {
		return submissionRepository.findAllByScoreIsNotNull();
	}

	@Transactional(readOnly = true)
	public boolean existsByJudgeAndLink(Integer idJudge, String subLink) {
		return submissionRepository.existsByIdJudgeAndSubLink(idJudge, subLink);
	}

}
