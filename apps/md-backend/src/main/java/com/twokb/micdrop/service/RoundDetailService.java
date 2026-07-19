package com.twokb.micdrop.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.myRounds.AdminBatchUpdateRequest;
import com.twokb.micdrop.dto.myRounds.AdminSubmissionDTO;
import com.twokb.micdrop.dto.myRounds.AdminSubmissionUpdateDTO;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoundDetailService {

	private final DiscordUserService discordUserService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private final RoundService roundService;

	private record ContestantStat(DiscordUser contestant, double avgScore, double stdDev, Instant maxSubmittedAt) {
	}

	@Transactional(readOnly = true)
	public List<AdminSubmissionDTO> getRoundSubmissions(Integer idRound) {
		List<Submission> subs = submissionService.getSubmissionsByRoundId(idRound);

		Map<Integer, DiscordUser> userMap = discordUserService.getAllUsers()
			.stream()
			.collect(Collectors.toMap(DiscordUser::getIdUser, Function.identity()));

		List<UserRound> userRounds = userRoundService.getUserRoundsByRoundId(idRound);
		Map<Integer, Integer> groupMap = userRounds.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.collect(Collectors.toMap(ur -> ur.getId().getUserId(), UserRound::getGroupNumber));

		return subs.stream().map(s -> {
			DiscordUser judge = userMap.get(s.getIdJudge());
			DiscordUser contestant = userMap.get(s.getIdContestant());
			Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);

			return new AdminSubmissionDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
					s.getTitle(), s.getArtist(), judge.getDiscordId(), judge.getUsername(), contestant.getDiscordId(),
					contestant.getUsername(), group, s.getSubmittedAt());
		}).toList();
	}

	@Transactional(readOnly = true)
	public List<AdminSubmissionDTO> getRoundSubmissionsByIds(Set<Integer> submissionIds) {
		List<Submission> subs = submissionService.getByIds(submissionIds);

		Map<Integer, DiscordUser> userMap = discordUserService.getAllUsers()
			.stream()
			.collect(Collectors.toMap(DiscordUser::getIdUser, Function.identity()));

		Map<Integer, Integer> groupMap = userRoundService.getUserRoundsByRoundId(subs.get(0).getIdRound())
			.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.collect(Collectors.toMap(ur -> ur.getId().getUserId(), UserRound::getGroupNumber));

		return subs.stream().map(s -> {
			DiscordUser judge = userMap.get(s.getIdJudge());
			DiscordUser contestant = userMap.get(s.getIdContestant());
			Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);

			return new AdminSubmissionDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
					s.getTitle(), s.getArtist(), judge.getDiscordId(), judge.getUsername(), contestant.getDiscordId(),
					contestant.getUsername(), group, s.getSubmittedAt());
		}).toList();
	}

	@Transactional
	public List<AdminSubmissionDTO> updateSubmissions(Integer idRound, AdminBatchUpdateRequest request) {
		for (AdminSubmissionUpdateDTO update : request.updates()) {
			submissionService.adminUpdateSubmission(update.idSubmission(), update.subLink(), update.title(),
					update.artist());
		}

		Set<Integer> updatedIds = request.updates()
			.stream()
			.map(AdminSubmissionUpdateDTO::idSubmission)
			.collect(Collectors.toSet());

		return getRoundSubmissionsByIds(updatedIds);
	}

	@Transactional
	public void calculatePreliminaryStatuses(Integer idRound, Integer groupNumber) {
		Round round = roundService.getRound(idRound);

		if (round.getSubmissionsOpen() || round.getEliminationAmount() == null || round.getEliminationAmount() <= 0) {
			throw new IllegalStateException("Round is not ready for eliminations. Check round configuration.");
		}

		List<UserRound> groupUsers = userRoundService.getUsersByRoundIdAndGroupNumber(idRound, groupNumber);

		List<DiscordUser> contestants = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.map(UserRound::getUser)
			.toList();

		List<DiscordUser> judges = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.map(UserRound::getUser)
			.toList();

		int expectedSubmissionsPerContestant = judges.size();

		// Get status only for contestants who submitted to all judges
		List<ContestantStat> activeStats = getGroupStats(idRound, contestants, judges);

		Set<Integer> activeContestantIds = activeStats.stream()
			.map(stat -> stat.contestant().getIdUser())
			.collect(Collectors.toSet());

		// Mark anyone who is not in the activeStats list as DID_NOT_SUBMIT
		for (DiscordUser contestant : contestants) {
			if (!activeContestantIds.contains(contestant.getIdUser())) {
				contestant.setPreliminaryStatus(ContestantStatus.DID_NOT_SUBMIT);
			}
		}

		// Assign ELIMINATED or ACTIVE to the valid contestants
		int eliminateCount = Math.min(round.getEliminationAmount(), activeStats.size());

		for (int i = 0; i < activeStats.size(); i++) {
			DiscordUser contestant = activeStats.get(i).contestant;

			if (i < eliminateCount) {
				contestant.setPreliminaryStatus(ContestantStatus.ELIMINATED);
			}
			else {
				contestant.setPreliminaryStatus(ContestantStatus.ACTIVE);
			}
		}
	}

	private List<ContestantStat> getGroupStats(Integer idRound, List<DiscordUser> contestants,
			List<DiscordUser> judges) {
		int expectedSubmissionsPerContestant = judges.size();
		List<ContestantStat> activeStats = new ArrayList<>();

		for (DiscordUser contestant : contestants) {
			List<Submission> subs = submissionService.getByRoundIdAndContestantIdAndJudgeIds(idRound,
					contestant.getIdUser(), judges.stream().map(DiscordUser::getIdUser).toList());

			long submittedCount = subs.stream()
				.filter(s -> s.getSubLink() != null && !s.getSubLink().isBlank())
				.count();

			// Skip if the contestant did not submit the required amount
			if (submittedCount < expectedSubmissionsPerContestant) {
				continue;
			}

			// Calculate average score
			double avgScore = subs.stream()
				.mapToDouble(s -> s.getScore() != null ? s.getScore().doubleValue() : 0.0)
				.average()
				.orElse(0.0);

			// Calculate standard deviation (first tie-breaking criteria)
			double variance = subs.stream()
				.mapToDouble(s -> s.getScore() != null ? Math.pow(s.getScore().doubleValue() - avgScore, 2) : 0.0)
				.average()
				.orElse(0.0);

			double stdDev = Math.sqrt(variance);

			// Get the latest submission time (second tie-breaking criteria)
			Instant maxSubmittedAt = subs.stream()
				.map(Submission::getSubmittedAt)
				.filter(Objects::nonNull)
				.max(Instant::compareTo)
				.orElse(Instant.EPOCH);

			activeStats.add(new ContestantStat(contestant, avgScore, stdDev, maxSubmittedAt));
		}

		// Sort by average score ascending, then std dev descending, then max submission
		// time ascending
		activeStats.sort((a, b) -> {
			int scoreCmp = Double.compare(a.avgScore(), b.avgScore());
			if (scoreCmp != 0)
				return scoreCmp;

			int stdDevCmp = Double.compare(b.stdDev(), a.stdDev());
			if (stdDevCmp != 0)
				return stdDevCmp;

			return a.maxSubmittedAt.compareTo(b.maxSubmittedAt);
		});

		return activeStats;
	}

	@Transactional
	public void applyStatuses(Integer idRound, Integer groupNumber) {
		List<UserRound> groupUsers = userRoundService.getUsersByRoundIdAndGroupNumber(idRound, groupNumber);

		List<DiscordUser> contestants = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.map(UserRound::getUser)
			.toList();

		List<DiscordUser> judges = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.map(UserRound::getUser)
			.toList();

		// Get stats to find out who placed first
		List<ContestantStat> activeStats = getGroupStats(idRound, contestants, judges);

		// Grant 1st place bonus to the top contestant
		if (!activeStats.isEmpty()) {
			DiscordUser firstPlace = activeStats.get(0).contestant();
			UserRound ur = userRoundService.getUserRoundByRoundIdAndDiscordId(idRound, firstPlace.getDiscordId());
			ur.setPlacedFirst(true);
		}

		// Apply preliminary status to public status for all contestants in the group
		for (DiscordUser contestant : contestants) {
			if (contestant.getPreliminaryStatus() != null) {
				contestant.setStatus(contestant.getPreliminaryStatus());
			}
		}
	}

}
