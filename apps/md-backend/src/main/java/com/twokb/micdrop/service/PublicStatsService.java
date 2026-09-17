package com.twokb.micdrop.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.twokb.micdrop.dto.stats.ContestantGlobalStatDTO;
import com.twokb.micdrop.dto.stats.PublicStatResponseDTO;
import com.twokb.micdrop.dto.stats.RoundPerformanceDTO;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.model.UserRound;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PublicStatsService {

	private final SubmissionService submissionService;

	private final UserRoundService userRoundService;

	private final DiscordUserService discordUserService;

	// Thread-safe in-memory cache to serve public requests instantly
	private final AtomicReference<PublicStatResponseDTO> cachedStats = new AtomicReference<>(null);

	// Retrieves the stats. If cache is empty, it builds it
	public PublicStatResponseDTO getPublicStats() {
		PublicStatResponseDTO stats = cachedStats.get();
		if (stats == null) {
			stats = buildAndCacheStats();
		}
		return stats;
	}

	public PublicStatResponseDTO buildAndCacheStats() {
		log.info("Building public stats cache...");

		List<DiscordUser> allContestants = discordUserService.getAllCurrentOrExContestants();
		List<Submission> allSubmissions = submissionService.getAllScoredSubmissions();

		Map<Integer, Map<Integer, List<Submission>>> subsByUserAndRound = allSubmissions.stream()
			.filter(s -> s.getScore() != null)
			.collect(Collectors.groupingBy(Submission::getIdContestant, Collectors.groupingBy(Submission::getIdRound)));

		// Precompute judge sort orders for each round to avoid repeated calculations
		List<UserRound> allJudgeAssignments = userRoundService.getAllJudgeAssignments();
		Map<Integer, Map<Integer, Integer>> judgeSortOrdersByRound = allJudgeAssignments.stream()
			.collect(Collectors.groupingBy(ur -> ur.getRound().getIdRound(), Collectors
				.toMap(ur -> ur.getUser().getIdUser(), ur -> ur.getSortOrder() != null ? ur.getSortOrder() : 999)));

		// Precompute contestant assignments by user
		List<UserRound> allAssignments = userRoundService.getAllContestantAssignments();
		Map<Integer, List<UserRound>> assignmentsByUser = allAssignments.stream()
			.collect(Collectors.groupingBy(ur -> ur.getUser().getIdUser()));

		Set<Integer> processedRoundNumbers = new HashSet<>();
		List<ContestantGlobalStatDTO> contestantStats = new ArrayList<>();

		for (DiscordUser user : allContestants) {
			List<UserRound> userRounds = assignmentsByUser.getOrDefault(user.getIdUser(), Collections.emptyList());

			Map<Integer, RoundPerformanceDTO> roundPerformances = new HashMap<>();
			List<BigDecimal> allScoresGlobal = new ArrayList<>();

			for (UserRound ur : userRounds) {
				Integer roundId = ur.getRound().getIdRound();
				Integer roundNumber = ur.getRound().getRoundNumber();
				Integer groupNum = ur.getGroupNumber() != null ? ur.getGroupNumber() : 1;

				processedRoundNumbers.add(roundNumber);

				// Check if the final statuses were applied for the group in this round
				boolean isApplied = ur.getStatusesApplied() != null && ur.getStatusesApplied();

				if (!isApplied) {
					// Hide the round performance if the statuses were not applied yet to
					// avoid spoilers
					roundPerformances.put(roundNumber, new RoundPerformanceDTO(roundNumber, groupNum, null, null,
							Collections.emptyList(), true, false, null, null));
				}
				else {
					List<Submission> subs = subsByUserAndRound.getOrDefault(user.getIdUser(), Collections.emptyMap())
						.get(roundId);

					if (subs == null || subs.isEmpty()) {
						// DNS: Group is applied, but user has no valid submissions
						roundPerformances.put(roundNumber, new RoundPerformanceDTO(roundNumber, groupNum, null, null,
								Collections.emptyList(), false, true, null, null));
					}
					else {
						// Sort the round individual scores by judge sort order
						Map<Integer, Integer> currentRoundJudges = judgeSortOrdersByRound.getOrDefault(roundId,
								Collections.emptyMap());

						List<BigDecimal> roundScores = subs.stream()
							.sorted(Comparator.comparing(s -> currentRoundJudges.getOrDefault(s.getIdJudge(), 999)))
							.map(Submission::getScore)
							.toList();

						allScoresGlobal.addAll(roundScores);

						Double roundAvg = calculateAverage(roundScores);
						Double roundStdDev = calculateStdDev(roundScores, roundAvg);

						// Get the latest submission time for this contestant in this
						// round to use as a tie-breaker
						Instant latestSubmissionTime = subs.stream()
							.map(Submission::getSubmittedAt)
							.filter(Objects::nonNull)
							.max(Instant::compareTo)
							.orElse(null);

						roundPerformances.put(roundNumber, new RoundPerformanceDTO(roundNumber, groupNum, roundAvg,
								roundStdDev, roundScores, false, false, latestSubmissionTime, null));
					}
				}
			}

			// Get all valid round averages for this contestant
			List<Double> roundAverages = roundPerformances.values()
				.stream()
				.filter(rp -> !rp.isPending() && !rp.isDns())
				.map(RoundPerformanceDTO::average)
				.toList();

			// Calculate how many valid rounds the contestant successfully participated in
			Integer roundsPlayed = roundAverages.size();

			Double globalAvg = allScoresGlobal.isEmpty() ? null : calculateAverage(allScoresGlobal);
			Double globalStdDev = roundAverages.isEmpty() ? null : calculateStdDevForAverages(roundAverages, globalAvg);
			Double globalMedian = allScoresGlobal.isEmpty() ? null : calculateMedian(allScoresGlobal);

			String currentStatus = user.getStatus() != null ? user.getStatus().name() : "UNKNOWN";

			contestantStats.add(new ContestantGlobalStatDTO(user.getIdUser(), user.getUsername(), user.getAvatar(),
					user.getDiscordId(), currentStatus, roundsPlayed, globalAvg, globalStdDev, globalMedian,
					roundPerformances));
		}

		// Calculate group ranks for each round based on the triple tie-breaker logic
		for (Integer rNum : processedRoundNumbers) {
			// Group valid performances by groupNumber in this specific round
			Map<Integer, List<ContestantGlobalStatDTO>> contestantsByGroup = contestantStats.stream().filter(c -> {
				RoundPerformanceDTO rp = c.rounds().get(rNum);
				return rp != null && !rp.isPending() && !rp.isDns();
			}).collect(Collectors.groupingBy(c -> c.rounds().get(rNum).groupNumber()));

			// Sort each group individually using the exact triple tie-breaker logic
			for (List<ContestantGlobalStatDTO> groupContestants : contestantsByGroup.values()) {
				groupContestants.sort((c1, c2) -> {
					RoundPerformanceDTO rp1 = c1.rounds().get(rNum);
					RoundPerformanceDTO rp2 = c2.rounds().get(rNum);

					// Priority 1: Average (higher is better)
					int cmp = Double.compare(rp2.average(), rp1.average());

					if (cmp == 0) {
						// Priority 2: Std Dev (lower is better)
						cmp = Double.compare(rp1.stdDev(), rp2.stdDev());

						if (cmp == 0) {
							// Priority 3: Submitted At (earlier is better)
							if (rp1.submittedAt() != null && rp2.submittedAt() != null) {
								cmp = rp1.submittedAt().compareTo(rp2.submittedAt());
							}
							else if (rp1.submittedAt() != null) {
								cmp = -1; // rp1 has a timestamp, rp2 doesn't -> rp1 wins
							}
							else if (rp2.submittedAt() != null) {
								cmp = 1; // rp2 has a timestamp, rp1 doesn't -> rp2 wins
							}
						}
					}
					return cmp;
				});

				// Assign ranks and update the mutable map for each contestant
				for (int i = 0; i < groupContestants.size(); i++) {
					ContestantGlobalStatDTO c = groupContestants.get(i);
					RoundPerformanceDTO oldRp = c.rounds().get(rNum);

					int rank = i + 1;

					RoundPerformanceDTO rankedRp = new RoundPerformanceDTO(oldRp.roundNumber(), oldRp.groupNumber(),
							oldRp.average(), oldRp.stdDev(), oldRp.scores(), oldRp.isPending(), oldRp.isDns(),
							oldRp.submittedAt(), rank // Inject the calculated rank
					);
					c.rounds().put(rNum, rankedRp);
				}
			}
		}

		// Leaderboard sorting (nulls pushed to bottom implicitly)
		contestantStats.sort(
				// Priority 1: Rounds Played (higher is better)
				Comparator
					.comparing(ContestantGlobalStatDTO::roundsPlayed, Comparator.nullsLast(Comparator.reverseOrder()))
					// Priority 2: Survival Status (ACTIVE > ELIMINATED > DID_NOT_SUBMIT)
					.thenComparing(c -> "ACTIVE".equalsIgnoreCase(c.currentStatus()) ? 1 : 0, Comparator.reverseOrder())
					// Priority 3: Global Average (higher is better)
					.thenComparing(ContestantGlobalStatDTO::globalAverage,
							Comparator.nullsLast(Comparator.reverseOrder()))
					// Priority 4: Global Standard Deviation (lower is better)
					.thenComparing(ContestantGlobalStatDTO::globalStdDev,
							Comparator.nullsLast(Comparator.naturalOrder()))
					// Priority 5: Global Median (higher is better)
					.thenComparing(ContestantGlobalStatDTO::globalMedian,
							Comparator.nullsLast(Comparator.reverseOrder())));

		List<Integer> availableRounds = processedRoundNumbers.stream().sorted().toList();
		PublicStatResponseDTO finalResponse = new PublicStatResponseDTO(contestantStats, availableRounds);

		cachedStats.set(finalResponse);
		return finalResponse;
	}

	private Double calculateAverage(List<BigDecimal> scores) {
		if (scores == null || scores.isEmpty())
			return 0.0;

		return scores.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0.0);
	}

	private Double calculateStdDev(List<BigDecimal> scores, Double mean) {
		if (scores == null || scores.isEmpty())
			return 0.0;

		double variance = scores.stream().mapToDouble(s -> Math.pow(s.doubleValue() - mean, 2)).average().orElse(0.0);

		return Math.sqrt(variance);
	}

	private Double calculateMedian(List<BigDecimal> scores) {
		if (scores == null || scores.isEmpty())
			return 0.0;

		// Create a mutable copy to sort
		List<BigDecimal> sorted = new ArrayList<>(scores);
		Collections.sort(sorted);

		int size = sorted.size();
		if (size % 2 == 0) {
			// Even number of elements: average the two middle values
			double middle1 = sorted.get(size / 2 - 1).doubleValue();
			double middle2 = sorted.get(size / 2).doubleValue();
			return (middle1 + middle2) / 2.0;
		}
		else {
			// Odd number of elements: return the exact middle value
			return sorted.get(size / 2).doubleValue();
		}
	}

	private Double calculateStdDevForAverages(List<Double> averages, Double mean) {
		if (averages == null || averages.isEmpty())
			return 0.0;
		double variance = averages.stream().mapToDouble(a -> Math.pow(a - mean, 2)).average().orElse(0.0);
		return Math.sqrt(variance);
	}

}
