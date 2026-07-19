package com.twokb.micdrop.service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

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
	public boolean hasSubmissions(String discordId) {
		return submissionRepository.existsByContestant_User_DiscordId(discordId);
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

	@Transactional
	public Submission adminUpdateSubmission(Integer idSubmission, String subLink, String title, String artist) {
		Submission sub = getById(idSubmission);

		// Unescape the HTML entities back to normal URL characters before saving
		String rawLink = HtmlUtils.htmlUnescape(subLink);
		sub.setSubLink(rawLink);
		sub.setTitle(title);
		sub.setArtist(artist);

		return submissionRepository.save(sub);
	}

	@Transactional(readOnly = true)
	public Optional<Submission> getSubmissionByContestantAndSubLink(Integer idContestant, String subLink) {
		String rawLink = HtmlUtils.htmlUnescape(subLink);
		return submissionRepository.findFirstByIdContestantAndSubLink(idContestant, rawLink);
	}

	@Transactional(readOnly = true)
	public Optional<Submission> getSubmissionBySubLink(String subLink) {
		String rawLink = HtmlUtils.htmlUnescape(subLink);
		return submissionRepository.findFirstBySubLink(rawLink);
	}

}
