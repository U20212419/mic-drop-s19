package com.twokb.micdrop.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.JudgeAppDTO;
import com.twokb.micdrop.dto.myRounds.BatchScoreRequest;
import com.twokb.micdrop.dto.myRounds.BatchSubmissionRequest;
import com.twokb.micdrop.dto.myRounds.ContestantRoundDetailDTO;
import com.twokb.micdrop.dto.myRounds.JudgeDetailDTO;
import com.twokb.micdrop.dto.myRounds.JudgeRoundDetailDTO;
import com.twokb.micdrop.dto.myRounds.MyRoundDTO;
import com.twokb.micdrop.dto.myRounds.SubmissionJudgeDTO;
import com.twokb.micdrop.dto.myRounds.SubmitLinkRequest;
import com.twokb.micdrop.dto.myRounds.SubmitScoreRequest;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.JudgeApp;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MyRoundsService {

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private final DiscordUserService discordUserService;

	private final RoundService roundService;

    @Transactional(readOnly = true)
	public List<MyRoundDTO> getMyRounds(String discordId) {
		return userRoundService.getUserRoundsByDiscordId(discordId)
			.stream()
			.map(ur -> new MyRoundDTO(ur.getRound().getIdRound(), ur.getRound().getRoundNumber(),
					ur.getRound().getActive(), ur.getRound().getSubmissionsOpen(), ur.getUserRole().name(),
					ur.getGroupNumber()))
			.collect(Collectors.toList());
	}

    @Transactional(readOnly = true)
	public ContestantRoundDetailDTO getContestantDetail(Integer idRound, String discordId) {
		UserRound myUr = userRoundService.getUserRoundByRoundIdAndDiscordId(idRound, discordId);

		List<UserRound> judgeUrs = userRoundService.getUsersByRoundIdAndRoleAndGroupNumber(idRound,
				myUr.getGroupNumber(), UserRoleType.JUDGE.name().toLowerCase());

		List<JudgeDetailDTO> judges = judgeUrs.stream().map(jur -> {
			DiscordUser judgeUser = jur.getUser();
			JudgeApp app = judgeUser.getJudgeApp();

			JudgeAppDTO appDto = (app == null) ? null
					: new JudgeAppDTO(app.getFavArtists(), app.getLeastFavArtists(), app.getFavGenres(),
							app.getLeastFavGenres(), app.getJudgingStyle(), app.getSafePickCriteria(),
							app.getGivingBonus(), app.getBannedArtists(), app.getAmountPreference());

			Submission sub = submissionService
                .getByRoundIdAndContestantIdAndJudgeId(idRound, myUr.getUser().getIdUser(), judgeUser.getIdUser())
				.orElse(null);

			return new JudgeDetailDTO(judgeUser.getDiscordId(), judgeUser.getUsername(), appDto,
					sub != null ? sub.getSubLink() : "");
		}).toList();

		return new ContestantRoundDetailDTO(idRound, myUr.getRound().getRoundNumber(), myUr.getGroupNumber(),
				myUr.getRound().getSubmissionsOpen(), judges);
	}

    @Transactional(readOnly = true)
	public JudgeRoundDetailDTO getJudgeDetail(Integer idRound, String discordId) {
		DiscordUser judgeUser = discordUserService.getUserByDiscordId(discordId);

		UserRound myUr = userRoundService.getUserRoundByRoundIdAndDiscordId(idRound, discordId);

		List<Submission> subs = submissionService.getJudgeSubmissionsOrderedAsc(idRound,
				judgeUser.getIdUser());

		List<SubmissionJudgeDTO> subDtos = subs.stream()
			.map(s -> new SubmissionJudgeDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview()))
			.toList();

		return new JudgeRoundDetailDTO(idRound, myUr.getRound().getRoundNumber(), myUr.getGroupNumber(),
				myUr.getRound().getSubmissionsOpen(), subDtos);
	}

	@Transactional
	public void submitLinks(BatchSubmissionRequest request, String contestantDiscordId) {
		Round round = roundService.getRound(request.idRound());

		if (!round.getSubmissionsOpen()) {
			throw new IllegalStateException("The submission period for this round is not currently open.");
		}

		DiscordUser contestant = discordUserService.getUserByDiscordId(contestantDiscordId);

		for (SubmitLinkRequest slr : request.submissions()) {
			DiscordUser judge = discordUserService.getUserByDiscordId(slr.judgeDiscordId());

			Submission sub = submissionService
				.getByRoundIdAndContestantIdAndJudgeId(request.idRound(), contestant.getIdUser(), judge.getIdUser())
				.orElseGet(() -> {
					Submission newSub = new Submission();
					newSub.setIdRound(request.idRound());
					newSub.setIdContestant(contestant.getIdUser());
					newSub.setIdJudge(judge.getIdUser());
                    newSub.setSubmittedAt(Instant.now());
					return newSub;
				});

			sub.setSubLink(slr.subLink());
			submissionService.saveSubmission(sub);
		}
	}

	@Transactional
	public void submitScores(BatchScoreRequest request, String judgeDiscordId) {
		DiscordUser judge = discordUserService.getUserByDiscordId(judgeDiscordId);

		BigDecimal allowedIncrement = new BigDecimal("0.25");

		for (SubmitScoreRequest ssr : request.scores()) {
			Submission sub = submissionService.getById(ssr.idSubmission());

			if (!sub.getIdJudge().equals(judge.getIdUser())) {
				throw new IllegalStateException("You do not have permission to score this submission.");
			}

			BigDecimal score = ssr.score();

			// Validate score is between 0.00 and 10.00 and in increments of 0.25
			if (score != null) {
				if (score.compareTo(BigDecimal.ZERO) < 0 || score.compareTo(BigDecimal.TEN) > 0) {
					throw new IllegalArgumentException("Score must be between 0.00 and 10.00.");
				}
				if (score.remainder(allowedIncrement).compareTo(BigDecimal.ZERO) != 0) {
					throw new IllegalArgumentException("Score must be in increments of 0.25.");
				}
			}
			sub.setScore(ssr.score());
			sub.setReview(ssr.review());
			submissionService.saveSubmission(sub);
		}
	}

}
