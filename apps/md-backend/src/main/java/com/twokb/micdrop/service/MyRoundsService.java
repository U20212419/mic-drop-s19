package com.twokb.micdrop.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

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
				String rawLink = HtmlUtils.htmlUnescape(slr.subLink());
				if (shouldAdd && rawLink != null && !rawLink.isBlank()) {
					addOrIncrementCollectionItem(contestant, rawLink, null, null);
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

			// Unescape the HTML entities back to normal URL characters before saving
			String rawLink = HtmlUtils.htmlUnescape(slr.subLink());
			sub.setSubLink(rawLink);
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
	public List<CollectionItem> getMyCollection(String discordId) {
		DiscordUser contestant = discordUserService.getUserByDiscordId(discordId);
		return collectionItemService.getCollectionForUser(contestant);
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
		String rawLink = HtmlUtils.htmlUnescape(subLink);
		Submission ref = submissionService.getSubmissionBySubLink(rawLink)
			.orElseThrow(() -> new IllegalArgumentException("Submission with the provided link not found."));

		addOrIncrementCollectionItem(contestant, rawLink, ref.getTitle(), ref.getArtist());

		// Add the bonus to the user's collection
		collectionItemService.addToCollection(contestant, rawLink);

		ur.setBonusClaimed(true);
	}

	@Transactional
	private void addOrIncrementCollectionItem(DiscordUser contestant, String subLink, String providedTitle,
			String providedArtist) {
		List<CollectionItem> items = collectionItemService.getCollectionForUser(contestant);

		String title = providedTitle;
		String artist = providedArtist;

		String rawLink = HtmlUtils.htmlUnescape(subLink);

		// If the title or artist is not provided, try to find it from existing
		// submissions
		if (title == null || artist == null || title.isBlank() || artist.isBlank()) {
			Optional<Submission> pastSub = submissionService.getSubmissionByContestantAndSubLink(contestant.getIdUser(),
					rawLink);
			if (pastSub.isPresent()) {
				title = pastSub.get().getTitle();
				artist = pastSub.get().getArtist();
			}
		}

		final String finalTitle = title;
		final String finalArtist = artist;

		// Search for an existing collection item with the same subLink or title/artist
		// combination
		Optional<CollectionItem> matchingItem = items.stream()
			.filter(ci -> ci.getSubLink().equals(rawLink) || (finalTitle != null && finalArtist != null
					&& finalTitle.equalsIgnoreCase(ci.getTitle()) && finalArtist.equalsIgnoreCase(ci.getArtist())
					&& !finalTitle.isBlank() && !finalArtist.isBlank()))
			.findFirst();

		if (matchingItem.isPresent()) {
			// If a matching item is found, increment its count
			CollectionItem item = matchingItem.get();
			item.setQuantity(item.getQuantity() + 1);

			// Update title and artist if they are provided and not blank
			if (finalTitle != null && !finalTitle.isBlank()) {
				item.setTitle(finalTitle);
			}
			if (finalArtist != null && !finalArtist.isBlank()) {
				item.setArtist(finalArtist);
			}
		}
		else {
			// If no matching item is found, create a new collection item
			CollectionItem newItem = new CollectionItem();
			newItem.setContestant(contestant);
			newItem.setSubLink(rawLink);
			newItem.setTitle(finalTitle);
			newItem.setArtist(finalArtist);
			newItem.setQuantity(1);
		}
	}

}
