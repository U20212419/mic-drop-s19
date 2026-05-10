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
	public DiscordUser registerUser(String discordId, String username, GlobalRoleType globalRole) {
		discordUserRepository.findByDiscordId(discordId).ifPresent(user -> {
			// User already registered
			throw new IllegalArgumentException("User with Discord ID " + discordId + " is already registered.");
		});

		// New user: create user
		var user = new DiscordUser();
		user.setDiscordId(discordId);
		user.setUsername(username);
		// Manually registered users can't participate as contestants
		user.setStatus(ContestantStatus.NOT_CONTESTANT);
		user.setGlobalRole(globalRole);
		return discordUserRepository.save(user);
	}

	// Register a new user that reacts to the signup message to participate as contestant
	@Transactional
	public DiscordUser registerContestant(String discordId, String username) {
		return discordUserRepository.findByDiscordId(discordId).map(user -> {
			// Change contestant status to ACTIVE if they were INACTIVE
			if (user.getStatus() == ContestantStatus.INACTIVE) {
				user.setStatus(ContestantStatus.ACTIVE);
			}
			return user;
		}).orElseGet(() -> {
			// New user: create user with ACTIVE contestant status
			DiscordUser user = new DiscordUser();
			user.setDiscordId(discordId);
			user.setUsername(username);
			user.setStatus(ContestantStatus.ACTIVE);
			user.setGlobalRole(GlobalRoleType.USER);
			return discordUserRepository.save(user);
		});
	}

	@Transactional
	public DiscordUser unregisterContestant(String discordId) {
		// Only allow unregistering if the user has not submitted any entries
		if (submissionRepository.existsByContestant_User_DiscordId(discordId)) {
			throw new IllegalArgumentException(
					"User with Discord ID " + discordId + " has submissions and cannot be unregistered.");
		}

		// Mark contestant as INACTIVE instead of deleting
		return discordUserRepository.findByDiscordId(discordId).map(user -> {
			user.setStatus(ContestantStatus.INACTIVE);
			return user;
		}).orElseThrow(() -> new IllegalArgumentException("User with Discord ID " + discordId + " not found.")); // User
																													// not
																													// found
	}

	@Transactional
	public DiscordUser updateUser(Integer idUser, String discordId, String username, ContestantStatus status,
			GlobalRoleType globalRole) {
		DiscordUser user = discordUserRepository.findById(idUser)
			.orElseThrow(() -> new IllegalArgumentException("User with ID " + idUser + " not found."));

		// Check if the new Discord ID is already taken by another user
		if (!user.getDiscordId().equals(discordId) && discordUserRepository.existsByDiscordId(discordId)) {
			throw new IllegalArgumentException("Another user with Discord ID " + discordId + " already exists.");
		}

		user.setDiscordId(discordId);
		user.setUsername(username);
		user.setStatus(status);
		user.setGlobalRole(globalRole);
		return user;
	}

	@Transactional
	public DiscordUser eliminateUser(String discordId, boolean didNotSubmit) {
		return discordUserRepository.findByDiscordId(discordId).map(user -> {
			user.setStatus(didNotSubmit ? ContestantStatus.DID_NOT_SUBMIT : ContestantStatus.ELIMINATED);
			return user;
		}).orElseThrow(() -> new IllegalArgumentException("User with Discord ID " + discordId + " not found."));
	}

	@Transactional
	public void deleteUser(Integer idUser) {
		DiscordUser user = discordUserRepository.findById(idUser)
			.orElseThrow(() -> new IllegalArgumentException("User with ID " + idUser + " not found."));

		// If the user is associated with any other records in the database,
		// the global exception handler will catch the DataIntegrityViolationException
		discordUserRepository.delete(user);
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
		return discordUserRepository.existsByIdUserAndStatus(id, ContestantStatus.ACTIVE);
	}

	@Transactional(readOnly = true)
	public boolean didUserNotSubmit(Integer id) {
		return discordUserRepository.existsByIdUserAndStatus(id, ContestantStatus.DID_NOT_SUBMIT);
	}

	@Transactional(readOnly = true)
	public Set<Integer> getActiveUserIds() {
		return discordUserRepository.findUserIdsByStatus(ContestantStatus.ACTIVE.name().toLowerCase());
	}

	@Transactional(readOnly = true)
	public Set<Integer> getDidNotSubmitUserIds() {
		return discordUserRepository.findUserIdsByStatus(ContestantStatus.DID_NOT_SUBMIT.name().toLowerCase());
	}

	@Transactional(readOnly = true)
	public DiscordUser getUserByDiscordId(String discordId) {
		return discordUserRepository.findByDiscordId(discordId)
			.orElseThrow(() -> new IllegalArgumentException("User with Discord ID " + discordId + " not found."));
	}

}
