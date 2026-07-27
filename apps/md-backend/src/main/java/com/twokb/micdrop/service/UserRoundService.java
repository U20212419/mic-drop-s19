package com.twokb.micdrop.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.RoundAssignmentDTO;
import com.twokb.micdrop.dto.RoundAssignmentsResponse;
import com.twokb.micdrop.dto.UserAssignmentDTO;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.model.UserRoundId;
import com.twokb.micdrop.repository.UserRoundRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserRoundService {

	private final UserRoundRepository userRoundRepository;

	private final DiscordUserService discordUserService;

	private final RoundService roundService;

	@Transactional
	public void assignContestantToRound(Integer userId, Integer roundNumber) {
		if (discordUserService.isUserActive(userId)) {
			assignUserToRound(userId, roundNumber, UserRoleType.CONTESTANT);
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

		assignUserToRound(userId, roundNumber, UserRoleType.JUDGE);
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
	private void assignUserToRound(Integer userId, Integer roundNumber, UserRoleType userRole) {
		var round = roundService.getRoundByNumber(roundNumber);
		var id = new UserRoundId(userId, round.getIdRound());

		if (userRoundRepository.existsById(id)) {
			throw new IllegalArgumentException(
					"User with ID " + userId + " is already assigned to round " + roundNumber + ".");
		}

		var user = discordUserService.getUserById(userId);

		var userRound = new UserRound();
		userRound.setId(id);
		userRound.setUser(user);
		userRound.setRound(round);
		userRound.setUserRole(userRole);
		userRoundRepository.save(userRound);
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
		toDelete.forEach(ur -> removeUserFromRound(ur.getUser().getIdUser(), roundNumber));

		// Perform updates
		toUpdate.forEach(ur -> {
			ur.setGroupNumber(targetMap.get(ur.getUser().getIdUser()));
		});

		// Perform additions
		if (!toAdd.isEmpty()) {
			if (userRole == UserRoleType.CONTESTANT) {
				assignContestantsToRound(toAdd, roundNumber);
			}
			else if (userRole == UserRoleType.JUDGE) {
				assignJudgesToRound(toAdd, roundNumber);
			}
		}
	}

	@Transactional(readOnly = true)
	public Integer getGroupNumberForUserInRound(Integer userId, Integer roundNumber) {
		return userRoundRepository.findById_UserIdAndRound_RoundNumber(userId, roundNumber)
			.map(UserRound::getGroupNumber)
			.orElse(1); // Default to group 1 if not assigned to any group
	}

	@Transactional
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
		List<UserRound> newAssignments = previousAssignments.stream().map(prev -> {
			var ur = new UserRound();
			ur.setId(new UserRoundId(prev.getId().getUserId(), idRound));
			ur.setUser(prev.getUser());
			ur.setRound(currentRound);
			ur.setUserRole(UserRoleType.CONTESTANT);
			// Keep the same group number as the previous round
			ur.setGroupNumber(prev.getGroupNumber());
			return ur;
		}).toList();

		userRoundRepository.saveAll(newAssignments);
		return getRoundAssignments(idRound);
	}

	@Transactional
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

		List<UserAssignmentDTO> randomAssignments = new ArrayList<>(activeContestantIds.size());
		for (int index = 0; index < activeContestantIds.size(); index++) {
			int groupNumber = (index % round.getGroupCount()) + 1;
			randomAssignments.add(new UserAssignmentDTO(activeContestantIds.get(index), groupNumber));
		}

		syncRole(idRound, round.getRoundNumber(), randomAssignments, UserRoleType.CONTESTANT);
		return getRoundAssignments(idRound);
	}

	@Transactional(readOnly = true)
	public RoundAssignmentsResponse getRoundAssignments(Integer idRound) {
		// Fetch all assignments for this round in a single DB query (prevents N+1
		// problem)
		List<UserRound> allAssignments = getUserRoundsByRoundId(idRound);

		List<RoundAssignmentDTO> contestantDTOs = allAssignments.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
			.map(ur -> new RoundAssignmentDTO(ur.getUser().getIdUser(), ur.getUser().getUsername(),
					ur.getGroupNumber()))
			.toList();

		List<RoundAssignmentDTO> judgeDTOs = allAssignments.stream()
			.filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
			.map(ur -> new RoundAssignmentDTO(ur.getUser().getIdUser(), ur.getUser().getUsername(),
					ur.getGroupNumber()))
			.toList();

		return new RoundAssignmentsResponse(contestantDTOs, judgeDTOs);
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
	public List<UserRound> getUsersByRoundIdAndRoleAndGroupNumber(Integer idRound, Integer groupNumber,
			String userRole) {
		return userRoundRepository.findById_RoundIdAndGroupNumberAndUserRole(idRound, groupNumber, userRole);
	}

	@Transactional(readOnly = true)
	public List<UserRound> getUsersByRoundIdAndGroupNumber(Integer idRound, Integer groupNumber) {
		return userRoundRepository.findById_RoundIdAndGroupNumber(idRound, groupNumber);
	}

}
