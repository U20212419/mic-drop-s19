package com.twokb.micdrop.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import com.twokb.micdrop.dto.CollectionItemResponse;
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
import com.twokb.micdrop.model.CollectionItem;
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

	private final CollectionItemService collectionItemService;

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
				myUr.getRound().getSubmissionsOpen(), myUr.getRound().getSpecialRound(), judges);
	}

	@Transactional(readOnly = true)
	public JudgeRoundDetailDTO getJudgeDetail(Integer idRound, String discordId) {
		DiscordUser judgeUser = discordUserService.getUserByDiscordId(discordId);

		UserRound myUr = userRoundService.getUserRoundByRoundIdAndDiscordId(idRound, discordId);

		List<Submission> subs = submissionService.getJudgeSubmissionsOrderedAsc(idRound, judgeUser.getIdUser());

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
		List<UserRound> judges = userRoundService.getUsersByRoundIdAndRoleAndGroupNumber(request.idRound(),
				userRoundService.getUserRoundByRoundIdAndDiscordId(request.idRound(), contestantDiscordId)
					.getGroupNumber(),
				UserRoleType.JUDGE.name().toLowerCase());

		boolean isSpecialRound = round.getSpecialRound() != null && round.getSpecialRound();

		if (isSpecialRound) {
			// Deduct from collection
			collectionItemService.deductFromCollection(contestant, request.submissions());
		}
		else {
			// Add to collection
			long collectionAdditions = request.submissions()
				.stream()
				.filter(s -> Boolean.TRUE.equals(s.addToCollection()))
				.count();

			if (judges.size() > 3 && collectionAdditions != 3) {
				throw new IllegalArgumentException("You must select exactly 3 songs to add to your collection.");
			}

			for (SubmitLinkRequest slr : request.submissions()) {
				boolean shouldAdd = judges.size() <= 3 || Boolean.TRUE.equals(slr.addToCollection());

				if (shouldAdd && slr.subLink() != null && !slr.subLink().isBlank()) {
					collectionItemService.addToCollection(contestant, slr.subLink());
				}
			}
		}

		// Save submissions
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

	@Transactional(readOnly = true)
	public List<CollectionItemResponse> getMyCollection(String discordId) {
		DiscordUser contestant = discordUserService.getUserByDiscordId(discordId);
		List<CollectionItem> rawItems = collectionItemService.getCollectionForUser(contestant);

		// Group by subLink or by artist/title combination
		Map<String, List<CollectionItem>> groupedItems = rawItems.stream()
			.collect(Collectors.groupingBy(this::getSmartGroupingKey));

		return groupedItems.values().stream().map(items -> {
			CollectionItem first = items.get(0);

			// Quantity is the number of items in the group
			return new CollectionItemResponse(first.getSubLink(), first.getTitle(), first.getArtist(), items.size());
		}).toList();
	}

	private String getSmartGroupingKey(CollectionItem item) {
		if (item.getTitle() != null && !item.getTitle().isBlank() && item.getArtist() != null
				&& !item.getArtist().isBlank()) {
			// Normalize to make it case-insensitive and combine them
			return item.getArtist().trim().toLowerCase() + "|||" + item.getTitle().trim().toLowerCase();
		}
		return item.getSubLink();
	}

	@Transactional
	public void claimFirstPlaceBonus(Integer idRound, String discordId, String subLink) {
		DiscordUser contestant = discordUserService.getUserByDiscordId(discordId);
		UserRound ur = userRoundService.getUserRoundByRoundIdAndDiscordId(idRound, discordId);

		if (!ur.getPlacedFirst() || ur.getBonusClaimed()) {
			throw new IllegalStateException(
					"You are not eligible to claim the first place bonus for this round or have already claimed it.");
		}

		// Get the data for the song to be added to the collection
		Submission ref = submissionService.getSubmissionBySubLink(subLink)
			.orElseThrow(() -> new IllegalArgumentException("Submission with the provided link not found."));

		// Add the submission data to the user's collection
		collectionItemService.addToCollection(contestant, subLink, ref.getTitle(), ref.getArtist());

		ur.setBonusClaimed(true);
	}

}
