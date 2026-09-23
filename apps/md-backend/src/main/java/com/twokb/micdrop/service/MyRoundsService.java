package com.twokb.micdrop.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.ClaimableSongDTO;
import com.twokb.micdrop.dto.CollectionItemResponse;
import com.twokb.micdrop.dto.JudgeAppDTO;
import com.twokb.micdrop.dto.PendingBonusDTO;
import com.twokb.micdrop.dto.myRounds.BatchScoreRequest;
import com.twokb.micdrop.dto.myRounds.BatchScoreResponse;
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
					ur.getId().getGroupNumber(), ur.getRound().getSpecialRound()))
			.collect(Collectors.toList());
	}

	@Transactional(readOnly = true)
	public ContestantRoundDetailDTO getContestantDetail(Integer idRound, String discordId) {
		List<UserRound> myUrs = userRoundService.getUserRoundsByRoundIdAndDiscordId(idRound, discordId);
		// Contestants are assigned to a single group per round, so we can safely take the
		// first one
		UserRound myUr = myUrs.get(0);

		Round round = myUr.getRound();
		if (!round.getActive()) {
			throw new IllegalStateException("This round is not currently active.");
		}

		List<UserRound> judgeUrs = userRoundService.getUsersByRoundIdAndRoleAndGroupNumber(idRound,
				myUr.getId().getGroupNumber(), UserRoleType.JUDGE.name().toLowerCase());

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

			Integer sortOrder = (jur.getSortOrder() == null) ? 999 : jur.getSortOrder();

			return new JudgeDetailDTO(judgeUser.getDiscordId(), judgeUser.getUsername(), appDto,
					sub != null ? sub.getSubLink() : "", sub != null ? sub.getIdSubmission() : null, sortOrder);
		}).toList();

		return new ContestantRoundDetailDTO(idRound, myUr.getRound().getRoundNumber(), myUr.getId().getGroupNumber(),
				myUr.getRound().getSubmissionsOpen(), myUr.getRound().getSpecialRound(), judges);
	}

	@Transactional(readOnly = true)
	public JudgeRoundDetailDTO getJudgeDetail(Integer idRound, String discordId, Integer groupNumber) {
		DiscordUser judgeUser = discordUserService.getUserByDiscordId(discordId);

		UserRound myUr = userRoundService.findUserRoundsByRoundIdAndDiscordId(idRound, discordId)
			.stream()
			.filter(ur -> ur.getId().getGroupNumber().equals(groupNumber))
			.findFirst()
			.orElseThrow(
					() -> new IllegalArgumentException("Judge is not assigned to the specified group for this round."));

		Round round = myUr.getRound();
		if (!round.getActive()) {
			throw new IllegalStateException("This round is not currently active.");
		}

		List<Integer> groupContestantIds = userRoundService
			.getUsersByRoundIdAndRoleAndGroupNumber(idRound, groupNumber, UserRoleType.CONTESTANT.name().toLowerCase())
			.stream()
			.map(ur -> ur.getUser().getIdUser())
			.toList();

		List<Submission> subs = submissionService.getJudgeSubmissionsOrderedAsc(idRound, judgeUser.getIdUser())
			.stream()
			.filter(s -> groupContestantIds.contains(s.getIdContestant()))
			.toList();

		List<SubmissionJudgeDTO> subDtos = subs.stream()
			.map(s -> new SubmissionJudgeDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
					s.getArtist(), s.getTitle()))
			.toList();

		JudgeApp app = judgeUser.getJudgeApp();
		Boolean givingBonus = (app == null) ? false : app.getGivingBonus();

		return new JudgeRoundDetailDTO(idRound, round.getRoundNumber(), groupNumber, round.getSubmissionsOpen(),
				round.getSpecialRound(), givingBonus, subDtos);
	}

	@Transactional
	public void submitLinks(BatchSubmissionRequest request, String contestantDiscordId) {
		Round round = roundService.getRound(request.idRound());

		if (!round.getActive()) {
			throw new IllegalStateException("This round is not currently active.");
		}
		if (!round.getSubmissionsOpen()) {
			throw new IllegalStateException("The submission period for this round is not currently open.");
		}

		DiscordUser contestant = discordUserService.getUserByDiscordId(contestantDiscordId);

		// Get the contestant's group number for the round
		List<UserRound> contestantUrs = userRoundService.getUserRoundsByRoundIdAndDiscordId(request.idRound(),
				contestantDiscordId);
		// Contestants are assigned to a single group per round, so we can safely take the
		// first one
		Integer contestantGroup = contestantUrs.get(0).getId().getGroupNumber();

		List<UserRound> judges = userRoundService.getUsersByRoundIdAndRoleAndGroupNumber(request.idRound(),
				contestantGroup, UserRoleType.JUDGE.name().toLowerCase());

		// Validate that all submitted judges are actually assigned to the contestant's
		// group
		Set<String> expectedJudgeIds = judges.stream()
			.map(jur -> jur.getUser().getDiscordId())
			.collect(Collectors.toSet());

		Set<String> submittedJudgeIds = request.submissions()
			.stream()
			.map(SubmitLinkRequest::judgeDiscordId)
			.collect(Collectors.toSet());

		if (submittedJudgeIds.size() != expectedJudgeIds.size() || !expectedJudgeIds.containsAll(submittedJudgeIds)) {
			throw new IllegalStateException(
					"One or more submitted judges are not assigned to your group for this round.");
		}

		for (UserRound judgeUr : judges) {
			Optional<Submission> existingSub = submissionService.getByRoundIdAndContestantIdAndJudgeId(
					request.idRound(), contestant.getIdUser(), judgeUr.getUser().getIdUser());

			// If the submission record exists in the database, block resubmission
			// completely
			// Staff will handle any resubmission requests manually if needed
			if (existingSub.isPresent()) {
				throw new IllegalStateException("You have already submitted in this round. You cannot submit again.");
			}
		}

		boolean isSpecialRound = round.getSpecialRound() != null && round.getSpecialRound();
		// Map to hold the title and artist for each submitted link, to be used when
		// adding to the collection
		Map<String, String[]> metadataMap = new HashMap<>();

		if (isSpecialRound) {
			Map<String, Long> requestedLinksCount = request.submissions()
				.stream()
				.map(s -> s.subLink())
				.filter(link -> link != null && !link.isBlank())
				.collect(Collectors.groupingBy(link -> link, Collectors.counting()));

			// Validate that the contestant has enough copies of each song in their
			// collection
			for (Map.Entry<String, Long> entry : requestedLinksCount.entrySet()) {
				String linkToSubmit = entry.getKey();
				long copiesNeeded = entry.getValue();

				List<CollectionItem> userItems = collectionItemService.findByContestantAndSubLink(contestant,
						linkToSubmit);
				long copiesOwned = userItems.size();

				if (copiesOwned < copiesNeeded) {
					throw new IllegalStateException(
							"You do not have enough copies of the song " + linkToSubmit + " in your collection.");
				}

				if (!userItems.isEmpty()) {
					CollectionItem referenceItem = userItems.get(0);
					metadataMap.put(linkToSubmit, new String[] { referenceItem.getTitle(), referenceItem.getArtist() });
				}
			}

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

			Submission sub = new Submission();
			sub.setIdRound(request.idRound());
			sub.setIdContestant(contestant.getIdUser());
			sub.setIdJudge(judge.getIdUser());
			sub.setSubLink(slr.subLink());
			sub.setSubmittedAt(Instant.now());

			if (isSpecialRound && slr.subLink() != null && !slr.subLink().isBlank()) {
				String[] metadata = metadataMap.get(slr.subLink());
				if (metadata != null) {
					sub.setTitle(metadata[0]);
					sub.setArtist(metadata[1]);
				}
			}

			submissionService.saveSubmission(sub);
		}
	}

	@Transactional
	public BatchScoreResponse submitScores(BatchScoreRequest request, String judgeDiscordId) {
		DiscordUser judge = discordUserService.getUserByDiscordId(judgeDiscordId);

		BigDecimal allowedIncrement = new BigDecimal("0.25");

		int savedCount = 0;
		int skippedCount = 0;

		for (SubmitScoreRequest ssr : request.scores()) {
			Submission sub = submissionService.getById(ssr.idSubmission());

			// Skip if the submission does not belong to the judge
			if (!sub.getIdJudge().equals(judge.getIdUser())) {
				skippedCount++;
				continue;
			}

			boolean isAttemptingToScore = ssr.score() != null || (ssr.review() != null && !ssr.review().isBlank());

			// Skip if the judge is attempting to score a submission that has no link
			if (isAttemptingToScore && (sub.getSubLink() == null || sub.getSubLink().isBlank())) {
				skippedCount++;
				continue;
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
			savedCount++;
		}

		String message = skippedCount > 0
				? String.format("Processed %d scores. Skipped %d due to validation errors.", savedCount, skippedCount)
				: "All submissions processed successfully.";

		return new BatchScoreResponse(savedCount, skippedCount, message);
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
		List<UserRound> userRounds = userRoundService.getUserRoundsByRoundIdAndDiscordId(idRound, discordId);
		// Contestants are assigned to a single group per round, so we can safely take the
		// first one
		UserRound ur = userRounds.get(0);

		if (!ur.getPlacedFirst()) {
			throw new IllegalStateException(
					"You did not place first in this round and cannot claim the first place bonus.");
		}

		if (ur.getBonusClaimed()) {
			throw new IllegalStateException("You have already claimed the first place bonus for this round.");
		}

		// Validate active round and special round restrictions
		Round activeRound;
		try {
			activeRound = roundService.getActiveRound();
		}
		catch (IllegalStateException e) {
			throw new IllegalStateException("There is no active round at the moment.");
		}

		if (activeRound.getSpecialRound()) {
			throw new IllegalStateException("You cannot claim the first place bonus during a special round.");
		}

		int activeNum = activeRound.getRoundNumber();
		Integer previousNormalRoundNum = roundService.getPreviousNormalRoundNumber(activeNum);
		int targetRoundNum = ur.getRound().getRoundNumber();

		// Validate that the bonus belongs to the round between the previous normal round
		// and the current active round
		// This includes any special rounds that may have occurred in between
		boolean isClaimable = (previousNormalRoundNum != null)
				? (targetRoundNum >= previousNormalRoundNum && targetRoundNum <= activeNum)
				: (targetRoundNum <= activeNum);
		if (!isClaimable) {
			throw new IllegalStateException("This bonus has expired and can no longer be claimed.");
		}

		// Get the data for the song to be added to the collection
		Submission ref = submissionService.getSubmissionBySubLink(subLink)
			.orElseThrow(() -> new IllegalArgumentException("Submission with the provided link not found."));

		// Add the submission data to the user's collection
		collectionItemService.addToCollection(contestant, subLink, ref.getTitle(), ref.getArtist());

		ur.setBonusClaimed(true);
	}

	@Transactional(readOnly = true)
	public List<PendingBonusDTO> getPendingBonuses(String discordId) {
		Optional<Round> activeRoundOpt = roundService.getActiveRoundOptional();

		if (activeRoundOpt.isEmpty()) {
			return List.of();
		}

		Round activeRound = activeRoundOpt.get();

		// Disable bonus claiming entirely if the active round is a special round
		if (activeRound.getSpecialRound()) {
			return List.of();
		}

		int activeNum = activeRound.getRoundNumber();
		Integer previousNormalRoundNum = roundService.getPreviousNormalRoundNumber(activeNum);

		// Search all the active rounds where the user placed first and hasn't claimed the
		// bonus yet
		return userRoundService.getRoundsAbleToClaimBonus(discordId).stream().filter(ur -> {
			int targetRoundNum = ur.getRound().getRoundNumber();
			// Claimable if it belongs to the current normal round, previous normal round,
			// or any special round that occurred between them
			return (previousNormalRoundNum != null)
					? (targetRoundNum >= previousNormalRoundNum && targetRoundNum <= activeNum)
					: (targetRoundNum <= activeNum);
		}).map(ur -> new PendingBonusDTO(ur.getId().getRoundId(), ur.getRound().getRoundNumber())).toList();
	}

	@Transactional(readOnly = true)
	public List<ClaimableSongDTO> getClaimableSongs(Integer idRound, String discordId) {
		List<UserRound> ur = userRoundService.getUserRoundsByRoundIdAndDiscordId(idRound, discordId);
		// Contestants are assigned to a single group per round, so we can safely take the
		// first one
		Integer groupNumber = ur.get(0).getId().getGroupNumber();

		List<Integer> groupContestantIds = userRoundService
			.getUsersByRoundIdAndRoleAndGroupNumber(idRound, groupNumber, "contestant")
			.stream()
			.map(u -> u.getUser().getIdUser())
			.toList();

		List<Submission> groupSubmissions = submissionService.getSubmissionsByRoundIdAndContestantIds(idRound,
				groupContestantIds);

		// Exclude the songs that the contestant submitted themselves
		return groupSubmissions.stream()
			.filter(sub -> !sub.getContestant().getDiscordId().equals(discordId))
			.map(sub -> new ClaimableSongDTO(sub.getSubLink(),
					sub.getTitle() != null ? sub.getTitle() : "Unknown Title",
					sub.getArtist() != null ? sub.getArtist() : "Unknown Artist", sub.getContestant().getUsername()))
			.toList();
	}

}
