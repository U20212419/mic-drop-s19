package com.twokb.micdrop.service;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.GlobalRoleType;
import com.twokb.micdrop.repository.DiscordUserRepository;
import com.twokb.micdrop.repository.SubmissionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DiscordUserService {

	private final DiscordUserRepository discordUserRepository;

	private final SubmissionRepository submissionRepository;

	// Register a new user from the management page
	@Transactional
	public void registerUser(String discordId, String username, GlobalRoleType globalRole) {
		discordUserRepository.findByDiscordId(discordId).ifPresentOrElse(user -> {
			// User already registered
			throw new IllegalArgumentException("User with Discord ID " + discordId + " is already registered.");
		}, () -> {
			// New user: create user
			var user = new DiscordUser();
			user.setDiscordId(discordId);
			user.setUsername(username);
			// Manually registered users can't participate as contestants
			user.setStatus(ContestantStatus.NOT_CONTESTANT);
			user.setGlobalRole(globalRole);
			discordUserRepository.save(user);
		});
	}

	// Register a new user that reacts to the signup message to participate as contestant
	@Transactional
	public void registerContestant(String discordId, String username) {
		discordUserRepository.findByDiscordId(discordId).ifPresentOrElse(user -> {
			// Change contestant status to ACTIVE if they were INACTIVE
			if (user.getStatus() == ContestantStatus.INACTIVE) {
				user.setStatus(ContestantStatus.ACTIVE);
			}
		}, () -> {
			// New user: create user with ACTIVE contestant status
			var user = new DiscordUser();
			user.setDiscordId(discordId);
			user.setUsername(username);
			user.setStatus(ContestantStatus.ACTIVE);
			user.setGlobalRole(GlobalRoleType.USER);
			discordUserRepository.save(user);
		});
	}

	@Transactional
	public boolean unregisterContestant(String discordId) {
		// Only allow unregistering if the user has not submitted any entries
		if (submissionRepository.existsByContestant_User_DiscordId(discordId)) {
			return false; // User has submissions, cannot unregister
		}

		// Mark contestant as INACTIVE instead of deleting
		return discordUserRepository.findByDiscordId(discordId).map(user -> {
			user.setStatus(ContestantStatus.INACTIVE);
			return true; // Successfully marked as INACTIVE
		}).orElse(false); // User not found
	}

	@Transactional
	public void eliminateUser(String discordId) {
		discordUserRepository.findByDiscordId(discordId).ifPresent(user -> user.setStatus(ContestantStatus.ELIMINATED));
	}

	@Transactional(readOnly = true)
	public List<DiscordUser> getAllUsers() {
		return discordUserRepository.findAll();
	}

	@Transactional(readOnly = true)
	public List<DiscordUser> getAllUsersById(List<Integer> userIds) {
		return discordUserRepository.findAllById(userIds);
	}

	@Transactional(readOnly = true)
	public DiscordUser getUserById(Integer id) {
		return discordUserRepository.findById(id)
			.orElseThrow(() -> new IllegalArgumentException("User with ID " + id + " not found."));
	}

	@Transactional(readOnly = true)
	public boolean isUserActive(Integer id) {
		return discordUserRepository.existsByStatus(ContestantStatus.ACTIVE);
	}

	@Transactional(readOnly = true)
	public Set<Integer> getActiveUserIds() {
		return discordUserRepository.findUserIdsByStatus(ContestantStatus.ACTIVE);
	}

	@Transactional(readOnly = true)
	public DiscordUser getUserByDiscordId(String discordId) {
		return discordUserRepository.findByDiscordId(discordId)
			.orElseThrow(() -> new IllegalArgumentException("User with Discord ID " + discordId + " not found."));
	}

}
