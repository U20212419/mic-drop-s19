package com.twokb.micdrop.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
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
import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.UserSnowflake;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoundDetailService {

	private final JDA jda;

	private final CollectionItemService collectionItemService;

	private final DiscordUserService discordUserService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private final RoundService roundService;

	private final SystemSettingService systemSettingService;

	private final PublicStatsService publicStatsService;

	record ContestantStat(DiscordUser contestant, double avgScore, double stdDev, Instant maxSubmittedAt) {
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
			.collect(Collectors.toMap(ur -> ur.getId().getUserId(), ur -> ur.getId().getGroupNumber(),
					(existing, replacement) -> existing));
		Map<String, Integer> sortOrderMap = userRounds.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.collect(Collectors.toMap(ur -> ur.getId().getUserId() + "-" + ur.getId().getGroupNumber(),
					ur -> ur.getSortOrder() != null ? ur.getSortOrder() : 999, (existing, replacement) -> existing));

		return subs.stream().map(s -> {
			DiscordUser judge = userMap.get(s.getIdJudge());
			DiscordUser contestant = userMap.get(s.getIdContestant());
			Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);
			Integer sortOrder = sortOrderMap.getOrDefault(judge.getIdUser() + "-" + group, 999);

			return new AdminSubmissionDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
					s.getTitle(), s.getArtist(), judge.getDiscordId(), judge.getUsername(), contestant.getDiscordId(),
					contestant.getUsername(), group, s.getSubmittedAt(), sortOrder);
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
			.collect(Collectors.toMap(ur -> ur.getId().getUserId(), ur -> ur.getId().getGroupNumber(),
					(existing, replacement) -> existing));
		Map<String, Integer> sortOrderMap = userRoundService.getUserRoundsByRoundId(subs.get(0).getIdRound())
			.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.collect(Collectors.toMap(ur -> ur.getId().getUserId() + "-" + ur.getId().getGroupNumber(),
					ur -> ur.getSortOrder() != null ? ur.getSortOrder() : 999, (existing, replacement) -> existing));

		return subs.stream().map(s -> {
			DiscordUser judge = userMap.get(s.getIdJudge());
			DiscordUser contestant = userMap.get(s.getIdContestant());
			Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);
			Integer sortOrder = sortOrderMap.getOrDefault(judge.getIdUser() + "-" + group, 999);

			return new AdminSubmissionDTO(s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
					s.getTitle(), s.getArtist(), judge.getDiscordId(), judge.getUsername(), contestant.getDiscordId(),
					contestant.getUsername(), group, s.getSubmittedAt(), sortOrder);
		}).toList();
	}

	@Transactional
	public List<AdminSubmissionDTO> updateSubmissions(Integer idRound, AdminBatchUpdateRequest request) {
		for (AdminSubmissionUpdateDTO update : request.updates()) {
			Submission oldSub = submissionService.getById(update.idSubmission());

			if (oldSub == null) {
				throw new IllegalArgumentException("Submission with ID " + update.idSubmission() + " not found.");
			}

			// Sync with the table collection_item
			collectionItemService.syncCollectionItemData(oldSub.getContestant(), oldSub.getSubLink(), update.subLink(),
					update.title(), update.artist());

			// Update submission table
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

		if (round.getSubmissionsOpen() || round.getEliminationAmount() == null
				|| round.getEliminationAmount().isBlank()) {
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

		// Assign ELIMINATED or ACTIVE. DID_NOT_SUBMIT contestants consume the elimination
		// slots.
		long didNotSubmitCount = contestants.size() - activeStats.size();

		int groupEliminationAmount;
		try {
			groupEliminationAmount = Integer.parseInt(round.getEliminationAmount().split(",")[groupNumber - 1].trim());
		}
		catch (Exception e) {
			throw new IllegalStateException("Invalid or missing elimination amount configuration for group "
					+ groupNumber + ". Check round configuration.");
		}

		int remainingEliminations = (int) Math.max(0, groupEliminationAmount - didNotSubmitCount);

		int eliminateCount = Math.min(remainingEliminations, activeStats.size());

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

	public List<ContestantStat> getGroupStats(Integer idRound, List<DiscordUser> contestants,
			List<DiscordUser> judges) {
		int expectedSubmissionsPerContestant = judges.size();
		List<Integer> allJudgeIds = judges.stream().map(DiscordUser::getIdUser).toList();

		// Fetch all submissions and group them by contestant
		Map<DiscordUser, List<Submission>> submissionsByContestant = contestants.stream()
			.collect(Collectors.toMap(c -> c, c -> submissionService.getByRoundIdAndContestantIdAndJudgeIds(idRound,
					c.getIdUser(), allJudgeIds)));

		List<ContestantStat> activeStats = new ArrayList<>();

		for (DiscordUser contestant : contestants) {
			List<Submission> allContestantSubs = submissionsByContestant.get(contestant);

			// Verify if the contestant submitted at least one link
			boolean hasAnyValidLink = allContestantSubs.stream()
				.anyMatch(s -> s.getSubLink() != null && !s.getSubLink().isBlank());

			// Global DNS (didn't submit anything at all)
			if (!hasAnyValidLink) {
				continue;
			}

			// Calculate 'pure' average score using only the actual grades given by judges
			double sumValidScores = 0.0;
			int validScoresCount = 0;

			for (Submission s : allContestantSubs) {
				if (s.getSubLink() != null && !s.getSubLink().isBlank() && s.getScore() != null) {
					sumValidScores += s.getScore().doubleValue();
					validScoresCount++;
				}
			}
			double pureAvg = validScoresCount > 0 ? sumValidScores / validScoresCount : 0.0;

			// Build effective scores for the final math
			List<Double> effectiveScores = new ArrayList<>();
			Instant maxSubmittedAt = Instant.EPOCH;

			for (Submission s : allContestantSubs) {
				if (s.getSubLink() == null || s.getSubLink().isBlank()) {
					// Penalize: Partial DNS becomes 0.0
					effectiveScores.add(0.0);
				}
				else {
					if (s.getScore() == null) {
						// Impute: Judge didn't score
						effectiveScores.add(pureAvg);
					}
					else {
						// Normal: Judge scored the submission
						effectiveScores.add(s.getScore().doubleValue());
					}

					// Track submission time only for valid links
					if (s.getSubmittedAt() != null && s.getSubmittedAt().compareTo(maxSubmittedAt) > 0) {
						maxSubmittedAt = s.getSubmittedAt();
					}
				}
			}

			// Calculate final average and standard deviation including
			// penalties/imputations
			double finalAvg = effectiveScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

			double varianceSum = 0.0;
			for (Double score : effectiveScores) {
				varianceSum += Math.pow(score - finalAvg, 2);
			}
			double stdDev = Math.sqrt(varianceSum / effectiveScores.size());

			activeStats.add(new ContestantStat(contestant, finalAvg, stdDev, maxSubmittedAt));
		}

		// Sort by average score ascending, then std dev descending, then max submission
		// time descending
		activeStats.sort((a, b) -> {
			int scoreCmp = Double.compare(a.avgScore(), b.avgScore());
			if (scoreCmp != 0)
				return scoreCmp;

			int stdDevCmp = Double.compare(b.stdDev(), a.stdDev());
			if (stdDevCmp != 0)
				return stdDevCmp;

			return b.maxSubmittedAt.compareTo(a.maxSubmittedAt);
		});

		return activeStats;
	}

	@Transactional
	public void applyStatuses(Integer idRound, Integer groupNumber) {
		List<UserRound> groupUsers = userRoundService.getUsersByRoundIdAndGroupNumber(idRound, groupNumber);

		List<UserRound> contestantUserRounds = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.toList();

		List<DiscordUser> contestants = contestantUserRounds.stream().map(UserRound::getUser).toList();

		// Ensure preliminaryStatus are set for every contestant
		if (contestants.stream().anyMatch(c -> c.getPreliminaryStatus() == null)) {
			throw new IllegalStateException("Statuses must be calculated before applying them.");
		}

		List<DiscordUser> judges = groupUsers.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.map(UserRound::getUser)
			.toList();

		// Get stats to find out who placed first
		List<ContestantStat> activeStats = getGroupStats(idRound, contestants, judges);

		// Identify the 1st place (last in the sorted list) if anyone actually submitted
		DiscordUser firstPlace = activeStats.isEmpty() ? null : activeStats.get(activeStats.size() - 1).contestant();

		boolean firstPlaceFound = false;
		if (firstPlace != null) {
			// Grant 1st place bonus to the top contestant and remove it from all others
			for (UserRound ur : contestantUserRounds) {
				// Mark statuses as applied for all contestants in the group
				ur.setStatusesApplied(true);

				if (ur.getUser().getIdUser().equals(firstPlace.getIdUser())) {
					ur.setPlacedFirst(true);
					firstPlaceFound = true;
				}
				else {
					ur.setPlacedFirst(false);
				}
			}
		}

		if (!firstPlaceFound) {
			throw new IllegalStateException("First place contestant UserRound info not found.");
		}

		String eliminatedRoleId = systemSettingService.getSetting("eliminated_role_id").orElse("");
		String ytsRoleId = systemSettingService.getSetting("yts_role_id").orElse("");
		String contestantRoleId = systemSettingService.getSetting("contestant_role_id").orElse("");
		String rolesStr = systemSettingService.getSetting("group_roles_ids").orElse(null);

		String guildId = systemSettingService.getSetting("guild_id").orElse("");
		Guild guild = guildId.isEmpty() ? null : jda.getGuildById(guildId);

		Role eliminatedRole = (guild != null && !eliminatedRoleId.isEmpty()) ? guild.getRoleById(eliminatedRoleId)
				: null;
		Role ytsRole = (guild != null && !ytsRoleId.isEmpty()) ? guild.getRoleById(ytsRoleId) : null;
		Role contestantRole = (guild != null && !contestantRoleId.isEmpty()) ? guild.getRoleById(contestantRoleId)
				: null;

		List<Role> groupRoles = new ArrayList<>();
		if (guild != null && rolesStr != null && !rolesStr.isBlank()) {
			for (String roleId : rolesStr.split(",")) {
				String trimmedRoleId = roleId.trim();
				Role role = guild.getRoleById(trimmedRoleId);
				if (role != null) {
					groupRoles.add(role);
				}
				else {
					log.warn("Group role with ID {} not found in guild.", trimmedRoleId);
				}
			}
		}

		// Apply preliminary status to public status for all contestants in the group
		for (DiscordUser contestant : contestants) {
			contestant.setStatus(contestant.getPreliminaryStatus());

			// Discord role sync
			if (guild != null) {
				String discordId = contestant.getDiscordId();
				UserSnowflake snowflake = UserSnowflake.fromId(discordId);

				Member member = guild.getMember(snowflake);

				try {
					// Remove YTS role for everyone who has the role or isn't cached
					if (ytsRole != null && (member == null || member.getRoles().contains(ytsRole))) {
						guild.removeRoleFromMember(snowflake, ytsRole).queue(success -> {
						}, error -> log.warn("Failed to remove YTS role from user {}: {}", discordId,
								error.getMessage()));
					}

					// Add eliminated role for eliminated contestants, and remove the
					// contestant and group roles
					if (eliminatedRole != null && (contestant.getStatus() == ContestantStatus.ELIMINATED
							|| contestant.getStatus() == ContestantStatus.DID_NOT_SUBMIT)) {
						// Add eliminated role if not already present
						if (member == null || !member.getRoles().contains(eliminatedRole)) {
							guild.addRoleToMember(snowflake, eliminatedRole).queue(success -> {
							}, error -> log.warn("Failed to add eliminated role to user {}: {}", discordId,
									error.getMessage()));
						}

						// Remove contestant role if present
						if (contestantRole != null && (member == null || member.getRoles().contains(contestantRole))) {
							guild.removeRoleFromMember(snowflake, contestantRole).queue(success -> {
							}, error -> log.warn("Failed to remove contestant role from user {}: {}", discordId,
									error.getMessage()));
						}

						// Remove any group roles that the user has
						for (Role groupRole : groupRoles) {
							if (member == null || member.getRoles().contains(groupRole)) {
								guild.removeRoleFromMember(snowflake, groupRole).queue(success -> {
								}, error -> log.warn("Failed to remove group role {} from user {}: {}",
										groupRole.getName(), discordId, error.getMessage()));
							}
						}
					}
				}
				catch (Exception e) {
					log.error("Error while syncing Discord roles for user {}: {}", discordId, e.getMessage());
				}
			}
		}

		// Rebuild the public leaderboard cache now that statuses and scores are locked
		publicStatsService.buildAndCacheStats();
	}

}
