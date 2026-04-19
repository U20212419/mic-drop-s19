package com.twokb.micdrop.service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.model.UserRoundId;
import com.twokb.micdrop.repository.UserRoundRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
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
		if (!discordUserService.isUserActive(userId)) {
			assignUserToRound(userId, roundNumber, UserRoleType.JUDGE);
		}
		else {
			throw new IllegalArgumentException("User with ID " + userId
					+ " is an active contestant and cannot be assigned as a judge to round " + roundNumber + ".");
		}
	}

	@Transactional
	public void assignContestantsToRound(List<Integer> userIds, Integer roundNumber) {
		Set<Integer> activeUserIds = discordUserService.getActiveUserIds();
		List<Integer> validUserIds = userIds.stream().filter(activeUserIds::contains).toList();

		if (validUserIds.isEmpty()) {
			throw new IllegalArgumentException("No valid contestant IDs provided for round " + roundNumber
					+ ". All provided IDs are either inactive or not found.");
		}

		assignUsersToRound(validUserIds, roundNumber, UserRoleType.CONTESTANT);
	}

	@Transactional
	public void assignJudgesToRound(List<Integer> userIds, Integer roundNumber) {
		Set<Integer> activeUserIds = discordUserService.getActiveUserIds();
		List<Integer> validUserIds = userIds.stream().filter(id -> !activeUserIds.contains(id)).toList();

		if (validUserIds.isEmpty()) {
			throw new IllegalArgumentException("No valid judge IDs provided for round " + roundNumber
					+ ". All provided IDs are either active contestants or not found.");
		}

		assignUsersToRound(validUserIds, roundNumber, UserRoleType.JUDGE);
	}

	@Transactional
	private void assignUserToRound(Integer userId, Integer roundNumber, UserRoleType userRole) {
		var id = new UserRoundId(userId, roundNumber);

		if (userRoundRepository.existsById(id)) {
			throw new IllegalArgumentException(
					"User with ID " + userId + " is already assigned to round " + roundNumber + ".");
		}

		var user = discordUserService.getUserById(userId);
		var round = roundService.getRoundByNumber(roundNumber);

		var userRound = new UserRound();
		userRound.setId(id);
		userRound.setUser(user);
		userRound.setRound(round);
		userRound.setUserRole(userRole);
		userRoundRepository.save(userRound);
	}

	@Transactional
	private void assignUsersToRound(List<Integer> userIds, Integer roundNumber, UserRoleType userRole) {
		var round = roundService.getRoundByNumber(roundNumber);
		var users = discordUserService.getAllUsersById(userIds);

		Set<Integer> foundUserIds = users.stream().map(DiscordUser::getIdUser).collect(Collectors.toSet());

		List<Integer> notFoundIds = userIds.stream().filter(id -> !foundUserIds.contains(id)).toList();
		if (!notFoundIds.isEmpty()) {
			throw new IllegalArgumentException("Users not found with IDs: " + notFoundIds + ".");
		}

		Set<Integer> assignedIds = userRoundRepository.findUserIdsByRound_RoundNumber(roundNumber);

		var userRounds = users.stream().filter(user -> !assignedIds.contains(user.getIdUser())).map(user -> {
			var userRound = new UserRound();
			userRound.setId(new UserRoundId(user.getIdUser(), roundNumber));
			userRound.setUser(user);
			userRound.setRound(round);
			userRound.setUserRole(userRole);
			return userRound;
		}).toList();
		userRoundRepository.saveAll(userRounds);
	}

	@Transactional
	public void removeUserFromRound(Integer userId, Integer roundNumber) {
		var id = new UserRoundId(userId, roundNumber);

		if (!userRoundRepository.existsById(id)) {
			throw new IllegalArgumentException(
					"User with ID " + userId + " is not assigned to round " + roundNumber + ".");
		}

		userRoundRepository.deleteById(id);
	}

}
