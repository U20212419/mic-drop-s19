package com.twokb.micdrop.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.RoundAssignmentDTO;
import com.twokb.micdrop.dto.RoundAssignmentsResponse;
import com.twokb.micdrop.dto.UserAssignmentDTO;
import com.twokb.micdrop.event.ContestantRegisteredEvent;
import com.twokb.micdrop.event.ContestantUnregisteredEvent;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.model.UserRoundId;
import com.twokb.micdrop.repository.UserRoundRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.UserSnowflake;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserRoundService {

	private final JDA jda;

	private final UserRoundRepository userRoundRepository;

	private final DiscordUserService discordUserService;

	private final RoundService roundService;

	private final SystemSettingService systemSettingService;

	@Transactional
	@EventListener
	public void handleContestantRegistered(ContestantRegisteredEvent event) {
		assignContestantToRound(event.getUserId(), 1, true);
	}

	@Transactional
	@EventListener
	public void handleContestantUnregistered(ContestantUnregisteredEvent event) {
		removeUserFromRound(event.getUserId(), 1);
	}

	@Transactional
	public void assignContestantToRound(Integer userId, Integer roundNumber) {
		if (discordUserService.isUserActive(userId)) {
			assignUserToRound(userId, roundNumber, UserRoleType.CONTESTANT, false);
		}
		else {
			throw new IllegalArgumentException("User with ID " + userId
					+ " is not active and cannot be assigned as a contestant to round " + roundNumber + ".");
		}
	}

	@Transactional
	public void assignContestantToRound(Integer userId, Integer roundNumber, boolean isRegistering) {
		if (discordUserService.isUserActive(userId)) {
			assignUserToRound(userId, roundNumber, UserRoleType.CONTESTANT, isRegistering);
		}
		else {
			throw new IllegalArgumentException("User with ID " + userId
					+ " is not active and cannot be assigned as a contestant to round " + roundNumber + ".");
		}
	}

	@Transactional
	public void assignJudgeToRound(Integer userId, Integer roundNumber) {
		if (discordUserService.isUserActive(userId)) {
			throw new IllegalArgumentException("User with ID " + userId
					+ " is an active contestant and cannot be assigned as a judge to round " + roundNumber + ".");
		}

		if (discordUserService.didUserNotSubmit(userId)) {
			throw new IllegalArgumentException("User with ID " + userId
					+ " did not submit in a previous round and cannot be assigned as a judge to round " + roundNumber
					+ ".");
		}

		assignUserToRound(userId, roundNumber, UserRoleType.JUDGE, false);
	}

	@Transactional
	public void assignContestantsToRound(List<UserAssignmentDTO> assignments, Integer roundNumber) {
		log.info("Assigning contestants to round {}: {}", roundNumber, assignments);
		Set<Integer> activeUserIds = discordUserService.getActiveUserIds();
		log.info("Active user IDs: {}", activeUserIds);
		List<UserAssignmentDTO> validAssignments = assignments.stream()
			.filter(assignment -> activeUserIds.contains(assignment.idUser()))
			.toList();
		log.info("Valid contestant assignments for round {}: {}", roundNumber, validAssignments);

		if (validAssignments.isEmpty()) {
			throw new IllegalArgumentException("No valid contestant IDs provided for round " + roundNumber
					+ ". All provided IDs are either inactive or not found.");
		}

		assignUsersToRound(validAssignments, roundNumber, UserRoleType.CONTESTANT);
	}

	@Transactional
	public void assignJudgesToRound(List<UserAssignmentDTO> assignments, Integer roundNumber) {
		Set<Integer> activeUserIds = discordUserService.getActiveUserIds();
		Set<Integer> didNotSubmitUserIds = discordUserService.getDidNotSubmitUserIds();
		List<UserAssignmentDTO> validAssignments = assignments.stream()
			.filter(assignment -> !activeUserIds.contains(assignment.idUser())
					&& !didNotSubmitUserIds.contains(assignment.idUser()))
			.toList();

		if (validAssignments.isEmpty()) {
			throw new IllegalArgumentException("No valid judge IDs provided for round " + roundNumber
					+ ". All provided IDs are either active contestants, did not submit, or were not found.");
		}

		assignUsersToRound(validAssignments, roundNumber, UserRoleType.JUDGE);
	}

	@Transactional
	private void assignUserToRound(Integer userId, Integer roundNumber, UserRoleType userRole, boolean isRegistering) {
		var round = roundService.getRoundByNumber(roundNumber);
		var id = new UserRoundId(userId, round.getIdRound());

		var existingUserRound = userRoundRepository.findById(id);

		if (existingUserRound.isPresent()) {
			if (isRegistering) {
				UserRound ur = existingUserRound.get();
				// If the user is already assigned to the round but has no group number,
				// set it to 1
				if (ur.getGroupNumber() == null || ur.getGroupNumber() == 0) {
					ur.setGroupNumber(1);
					userRoundRepository.saveAndFlush(ur);
					log.info(
							"User with ID {} was already assigned to round {} but had no group number. Set group number to 1.",
							userId, roundNumber);
				}
				return; // If the user already registered before, do nothing as they are
						// trying to register again
			}
			throw new IllegalArgumentException(
					"User with ID " + userId + " is already assigned to round " + roundNumber + ".");
		}

		var user = discordUserService.getUserById(userId);

		var userRound = new UserRound();
		userRound.setId(id);
		userRound.setUser(user);
		userRound.setRound(round);
		userRound.setUserRole(userRole);
		if (isRegistering) {
			userRound.setGroupNumber(1); // Default group number for registering users in
											// round 1
		}
		log.info("Assigning user with ID {} to round {} as {}. Registering: {}", userId, roundNumber, userRole,
				isRegistering);
		userRoundRepository.save(userRound);
		log.info("User with ID {} assigned to round {} as {} successfully.", userId, roundNumber, userRole);
	}

	@Transactional
	private void assignUsersToRound(List<UserAssignmentDTO> assignments, Integer roundNumber, UserRoleType userRole) {
		var round = roundService.getRoundByNumber(roundNumber);

		List<Integer> userIds = assignments.stream().map(UserAssignmentDTO::idUser).toList();
		var users = discordUserService.getAllUsersById(userIds);

		Set<Integer> foundUserIds = users.stream().map(DiscordUser::getIdUser).collect(Collectors.toSet());
		List<Integer> notFoundIds = userIds.stream().filter(id -> !foundUserIds.contains(id)).toList();
		if (!notFoundIds.isEmpty()) {
			throw new IllegalArgumentException("Users not found with IDs: " + notFoundIds + ".");
		}

		Map<Integer, Integer> groupMap = assignments.stream()
			.collect(Collectors.toMap(UserAssignmentDTO::idUser, UserAssignmentDTO::groupNumber));

		Set<Integer> assignedIds = userRoundRepository.findUserIdsByRound_RoundNumber(roundNumber);

		var userRounds = users.stream().filter(user -> !assignedIds.contains(user.getIdUser())).map(user -> {
			var userRound = new UserRound();
			userRound.setId(new UserRoundId(user.getIdUser(), round.getIdRound()));
			userRound.setUser(user);
			userRound.setRound(round);
			userRound.setUserRole(userRole);
			userRound.setGroupNumber(groupMap.get(user.getIdUser()));
			return userRound;
		}).toList();

		userRoundRepository.saveAll(userRounds);
	}

	@Transactional
	public void removeUserFromRound(Integer userId, Integer roundNumber) {
		var round = roundService.getRoundByNumber(roundNumber);
		var id = new UserRoundId(userId, round.getIdRound());

		if (!userRoundRepository.existsById(id)) {
			throw new IllegalArgumentException(
					"User with ID " + userId + " is not assigned to round " + roundNumber + ".");
		}

		userRoundRepository.deleteById(id);
	}

	@Transactional
	public RoundAssignmentsResponse syncRoundAssignments(Integer idRound, List<UserAssignmentDTO> targetContestants,
			List<UserAssignmentDTO> targetJudges) {
		var round = roundService.getRound(idRound);
		Integer roundNumber = round.getRoundNumber();

		if (round.getActive()) {
			throw new IllegalStateException(
					"Cannot modify assigned users for an active round. Please deactivate it first.");
		}

		log.info("Syncing round {} assignments. Target contestants: {}, Target judges: {}", roundNumber,
				targetContestants, targetJudges);
		// Process contestants
		syncRole(idRound, roundNumber, targetContestants, UserRoleType.CONTESTANT);

		// Process judges
		syncRole(idRound, roundNumber, targetJudges, UserRoleType.JUDGE);

		// Update ContestantStatus to NOT_CONTESTANT for all assigned judges if they were
		// INACTIVE so that they can log into the website
		for (UserAssignmentDTO judge : targetJudges) {
			DiscordUser user = discordUserService.getUserById(judge.idUser());
			if (user.getStatus() == ContestantStatus.INACTIVE) {
				user.setStatus(ContestantStatus.NOT_CONTESTANT);
				discordUserService.saveUser(user);
				log.info("Updated status of user {} from INACTIVE to NOT_CONTESTANT as they are assigned as a judge.",
						user.getIdUser());
			}
		}

		// Return updated assignments
		return getRoundAssignments(idRound);
	}

	@Transactional
	private void syncRole(Integer idRound, Integer roundNumber, List<UserAssignmentDTO> targetAssignmentsList,
			UserRoleType userRole) {
		List<UserAssignmentDTO> targetAssignments = targetAssignmentsList != null ? targetAssignmentsList : List.of();

		Map<Integer, Integer> targetMap = targetAssignments.stream()
			.collect(Collectors.toMap(UserAssignmentDTO::idUser, UserAssignmentDTO::groupNumber));

		String userRoleStr = userRole.name().toLowerCase();

		// Get current assignments for the role in the round
		List<UserRound> currentAssignments = userRoundRepository.findByRoundIdAndRole(idRound, userRoleStr);

		// Identify users to delete in database
		List<UserRound> toDelete = currentAssignments.stream()
			.filter(ur -> !targetMap.containsKey(ur.getUser().getIdUser()))
			.toList();

		// Identify users to update in both database and target list
		List<UserRound> toUpdate = currentAssignments.stream()
			.filter(ur -> targetMap.containsKey(ur.getUser().getIdUser())
					&& !ur.getGroupNumber().equals(targetMap.get(ur.getUser().getIdUser())))
			.toList();

		// Identify users to add in target list
		Set<Integer> currentIds = currentAssignments.stream()
			.map(ur -> ur.getUser().getIdUser())
			.collect(Collectors.toSet());
		List<UserAssignmentDTO> toAdd = targetAssignments.stream()
			.filter(ta -> !currentIds.contains(ta.idUser()))
			.toList();

		// Perform deletions
		toDelete.forEach(ur -> {
			removeUserFromRound(ur.getUser().getIdUser(), roundNumber);
			updateDiscordGroupRole(ur.getUser(), null); // Remove Discord role for the
														// user
		});

		// Perform updates
		toUpdate.forEach(ur -> {
			ur.setGroupNumber(targetMap.get(ur.getUser().getIdUser()));
			updateDiscordGroupRole(ur.getUser(), targetMap.get(ur.getUser().getIdUser()));
		});

		// Perform additions
		if (!toAdd.isEmpty()) {
			if (userRole == UserRoleType.CONTESTANT) {
				assignContestantsToRound(toAdd, roundNumber);
			}
			else if (userRole == UserRoleType.JUDGE) {
				assignJudgesToRound(toAdd, roundNumber);
			}

			// Sync roles for new additions
			List<Integer> addedUserIds = toAdd.stream().map(UserAssignmentDTO::idUser).toList();
			List<DiscordUser> addedUsers = discordUserService.getAllUsersById(addedUserIds);
			for (DiscordUser addedUser : addedUsers) {
				updateDiscordGroupRole(addedUser, targetMap.get(addedUser.getIdUser()));
			}
		}

		// Assign an order to the judge. The order of the array targetAssignments
		// determines the order of the judges.
		if (userRole == UserRoleType.JUDGE) {
			Map<Integer, List<UserAssignmentDTO>> judgesByGroup = targetAssignments.stream()
				.collect(Collectors.groupingBy(UserAssignmentDTO::groupNumber));

			for (List<UserAssignmentDTO> groupJudges : judgesByGroup.values()) {
				for (int i = 0; i < groupJudges.size(); i++) {
					UserAssignmentDTO dto = groupJudges.get(i);
					UserRound ur = userRoundRepository.findById(new UserRoundId(dto.idUser(), idRound)).orElse(null);
					if (ur != null) {
						ur.setSortOrder(i);
						userRoundRepository.save(ur);
					}
				}
			}
		}
	}

	@Transactional(readOnly = true)
	public Integer getGroupNumberForUserInRound(Integer userId, Integer roundNumber) {
		return userRoundRepository.findById_UserIdAndRound_RoundNumber(userId, roundNumber)
			.map(UserRound::getGroupNumber)
			.orElse(1); // Default to group 1 if not assigned to any group
	}

	@Transactional(readOnly = true)
	public RoundAssignmentsResponse autoAssignContestants(Integer idRound) {
		var currentRound = roundService.getRound(idRound);

		// Find the previous round based on roundNumber
		Round previousRound = roundService.getPreviousRound(currentRound.getRoundNumber())
			.orElseThrow(() -> new IllegalStateException("No previous round found to auto-assign from."));

		if (currentRound.getGroupCount() != previousRound.getGroupCount()) {
			throw new IllegalStateException(
					"Current round and previous round must have the same number of groups for auto-assignment.");
		}

		String userRoleStr = UserRoleType.CONTESTANT.name().toLowerCase();
		String statusStr = ContestantStatus.ACTIVE.name().toLowerCase();
		// Get all ACTIVE contestants from the previous round
		Set<Integer> previousRoundActiveContestantIds = userRoundRepository
			.findUserIdsByRound_RoundNumberAndUserRoleAndUserStatus(previousRound.getRoundNumber(), userRoleStr,
					statusStr);

		// Get previous assignments for those contestants in the previous round
		List<UserRound> previousAssignments = userRoundRepository
			.findById_RoundIdAndId_UserIdIn(previousRound.getIdRound(), previousRoundActiveContestantIds);

		// Map them to the current round
		List<RoundAssignmentDTO> newContestantDTOs = previousAssignments.stream()
			.map(prev -> new RoundAssignmentDTO(prev.getUser().getIdUser(), prev.getUser().getUsername(),
					prev.getGroupNumber(), null))
			.toList();

		// Fetch current judges to preserve them in the frontend preview
		List<RoundAssignmentDTO> currentJudgeDTOs = getRoundAssignments(idRound).judges();

		return new RoundAssignmentsResponse(newContestantDTOs, currentJudgeDTOs);
	}

	@Transactional(readOnly = true)
	public RoundAssignmentsResponse randomlyAssignContestants(Integer idRound) {
		Round round = roundService.getRound(idRound);

		if (round.getActive()) {
			throw new IllegalStateException(
					"Cannot randomly assign contestants for an active round. Please deactivate it first.");
		}

		if (round.getGroupCount() == null || round.getGroupCount() < 1) {
			throw new IllegalStateException("The round must have at least one group before assigning contestants.");
		}

		List<Integer> activeContestantIds = new ArrayList<>(discordUserService.getActiveUserIds());
		if (activeContestantIds.isEmpty()) {
			throw new IllegalStateException("There are no active contestants available to assign.");
		}

		Collections.shuffle(activeContestantIds);

		// Retrieve usernames to populate the preview DTOs properly
		List<DiscordUser> activeUsers = discordUserService.getAllUsersById(activeContestantIds);
		Map<Integer, String> usernameMap = activeUsers.stream()
			.collect(Collectors.toMap(DiscordUser::getIdUser, DiscordUser::getUsername));

		List<RoundAssignmentDTO> newContestantDTOs = new ArrayList<>(activeContestantIds.size());
		for (int index = 0; index < activeContestantIds.size(); index++) {
			int groupNumber = (index % round.getGroupCount()) + 1;
			Integer userId = activeContestantIds.get(index);
			newContestantDTOs.add(new RoundAssignmentDTO(userId, usernameMap.get(userId), groupNumber, null));
		}

		// Fetch current judges to preserve them in the frontend preview
		List<RoundAssignmentDTO> currentJudgeDTOs = getRoundAssignments(idRound).judges();

		return new RoundAssignmentsResponse(newContestantDTOs, currentJudgeDTOs);
	}

	private void updateDiscordGroupRole(DiscordUser user, Integer targetGroup) {
		String guildId = systemSettingService.getSetting("guild_id").orElse("");
		Guild guild = guildId.isEmpty() ? null : jda.getGuildById(guildId);

		if (guild == null) {
			throw new IllegalStateException("Guild with ID " + guildId + " not found.");
		}

		String rolesStr = systemSettingService.getSetting("group_roles_ids").orElse(null);
		if (rolesStr == null || rolesStr.isBlank()) {
			throw new IllegalStateException("Group roles are not configured in the system settings.");
		}

		List<String> roleIds = Arrays.asList(rolesStr.split(","));
		List<Role> roles = new ArrayList<>();

		for (String roleId : roleIds) {
			String trimmedRoleId = roleId.trim();
			Role role = guild.getRoleById(trimmedRoleId);

			if (role == null) {
				throw new IllegalArgumentException("Role with ID " + trimmedRoleId + " not found in the guild.");
			}

			roles.add(role);
		}

		Role targetRole = null;

		if (targetGroup != null) {
			if (targetGroup > 0 && targetGroup <= roles.size()) {
				targetRole = roles.get(targetGroup - 1);
			}
			else {
				throw new IllegalArgumentException(
						"Invalid target group number: " + targetGroup + " for user " + user.getUsername() + ".");
			}
		}

		UserSnowflake userSnowflake = UserSnowflake.fromId(user.getDiscordId());

		// Remove any existing group roles first to avoid multiple roles
		for (Role role : roles) {
			guild.removeRoleFromMember(userSnowflake, role).queue();
		}

		// Assign the new group role
		if (targetRole != null) {
			guild.addRoleToMember(userSnowflake, targetRole).queue();
		}
	}

	@Transactional(readOnly = true)
	public RoundAssignmentsResponse getRoundAssignments(Integer idRound) {
		// Fetch all assignments for this round in a single DB query (prevents N+1
		// problem)
		List<UserRound> allAssignments = getUserRoundsByRoundId(idRound);

		List<RoundAssignmentDTO> contestantDTOs = allAssignments.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.map(ur -> new RoundAssignmentDTO(ur.getUser().getIdUser(), ur.getUser().getUsername(), ur.getGroupNumber(),
					null))
			.toList();

		List<RoundAssignmentDTO> judgeDTOs = allAssignments.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.map(ur -> new RoundAssignmentDTO(ur.getUser().getIdUser(), ur.getUser().getUsername(), ur.getGroupNumber(),
					ur.getSortOrder()))
			.toList();

		return new RoundAssignmentsResponse(contestantDTOs, judgeDTOs);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getAllContestantAssignments() {
		return userRoundRepository.findByUserRole(UserRoleType.CONTESTANT.name().toLowerCase());
	}

	@Transactional(readOnly = true)
	public List<UserRound> getAllJudgeAssignments() {
		return userRoundRepository.findByUserRole(UserRoleType.JUDGE.name().toLowerCase());
	}

	@Transactional(readOnly = true)
	public List<UserRound> getUserRoundsByRoundId(Integer idRound) {
		return userRoundRepository.findById_RoundId(idRound);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getUserRoundsByDiscordId(String discordId) {
		return userRoundRepository.findByUser_DiscordId(discordId);
	}

	@Transactional(readOnly = true)
	public UserRound getUserRoundByRoundIdAndDiscordId(Integer idRound, String discordId) {
		return userRoundRepository.findById_RoundIdAndUser_DiscordId(idRound, discordId)
			.orElseThrow(() -> new IllegalArgumentException(
					"User with Discord ID " + discordId + " is not part of round with ID " + idRound + "."));
	}

	@Transactional(readOnly = true)
	public Optional<UserRound> findUserRoundByRoundIdAndDiscordId(Integer idRound, String discordId) {
		return userRoundRepository.findById_RoundIdAndUser_DiscordId(idRound, discordId);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getUsersByRoundIdAndRoleAndGroupNumber(Integer idRound, Integer groupNumber,
			String userRole) {
		return userRoundRepository.findById_RoundIdAndGroupNumberAndUserRole(idRound, groupNumber, userRole);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getUsersByRoundIdAndGroupNumber(Integer idRound, Integer groupNumber) {
		return userRoundRepository.findById_RoundIdAndGroupNumber(idRound, groupNumber);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getRoundsAbleToClaimBonus(String discordId) {
		return userRoundRepository.findByUser_DiscordIdAndUserRoleAndPlacedFirstTrueAndBonusClaimedFalse(discordId,
				"contestant");
	}

}
