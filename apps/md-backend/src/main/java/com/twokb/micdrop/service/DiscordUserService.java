package com.twokb.micdrop.service;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.GlobalRoleType;
import com.twokb.micdrop.repository.DiscordUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DiscordUserService {

	private final DiscordUserRepository discordUserRepository;

	private final SubmissionService submissionService;

	private final SystemSettingService systemSettingService;

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
		user.setHost(false);
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
			user.setHost(false);
			return discordUserRepository.save(user);
		});
	}

	@Transactional
	public DiscordUser unregisterContestant(String discordId) {
		// Only allow unregistering if the user has not submitted any entries
		if (submissionService.hasSubmissions(discordId)) {
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

	// Login or register user from Judge App page
	@Transactional
	public DiscordUser loginOrRegisterUser(String discordId, String username) {
		// If user exists, return it. If not, create a new one with default role and
		// status
		return discordUserRepository.findByDiscordId(discordId).orElseGet(() -> {
			DiscordUser newUser = new DiscordUser();
			newUser.setDiscordId(discordId);
			newUser.setUsername(username);
			newUser.setStatus(ContestantStatus.INACTIVE);
			newUser.setGlobalRole(GlobalRoleType.USER);
			newUser.setHost(false);
			return discordUserRepository.save(newUser);
		});
	}

	@Transactional
	public DiscordUser updateUser(Integer idUser, String discordId, String username, ContestantStatus status,
			GlobalRoleType globalRole, String requesterDiscordId) {
		DiscordUser user = discordUserRepository.findById(idUser)
			.orElseThrow(() -> new IllegalArgumentException("User with ID " + idUser + " not found."));

		String hostId = systemSettingService.getHostDiscordId();

		// Prevent changing the host's Discord ID or role unless the requester is the host
		// themselves
		if (user.getDiscordId().equals(hostId) && !requesterDiscordId.equals(hostId)) {
			throw new IllegalStateException("The host's info cannot be changed by other users.");
		}

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

		String hostId = systemSettingService.getHostDiscordId();

		// Prevent deleting the host
		if (user.getDiscordId().equals(hostId)) {
			throw new IllegalStateException("The host cannot be deleted.");
		}

		// If the user is associated with any other records in the database,
		// the global exception handler will catch the DataIntegrityViolationException
		discordUserRepository.delete(user);
	}

	@Transactional(readOnly = true)
	public List<DiscordUser> getAllUsers() {
		List<DiscordUser> users = discordUserRepository.findAll();

		String hostId = systemSettingService.getHostDiscordId();

		users.stream().filter(u -> u.getDiscordId().equals(hostId)).findFirst().ifPresent(host -> host.setHost(true));

		return users;
	}

	@Transactional(readOnly = true)
	public List<DiscordUser> getAllUsersById(List<Integer> userIds) {
		List<DiscordUser> users = discordUserRepository.findAllById(userIds);

		String hostId = systemSettingService.getHostDiscordId();

		users.stream().filter(u -> u.getDiscordId().equals(hostId)).findFirst().ifPresent(host -> host.setHost(true));

		return users;
	}

	@Transactional(readOnly = true)
	public DiscordUser getUserById(Integer id) {
		DiscordUser user = discordUserRepository.findById(id)
			.orElseThrow(() -> new IllegalArgumentException("User with ID " + id + " not found."));

		String hostId = systemSettingService.getHostDiscordId();

		if (user.getDiscordId().equals(hostId)) {
			user.setHost(true);
		}

		return user;
	}

	@Transactional(readOnly = true)
	public boolean isUserActive(Integer id) {
		return discordUserRepository.existsByIdUserAndStatus(id, ContestantStatus.ACTIVE.name().toLowerCase());
	}

	@Transactional(readOnly = true)
	public boolean didUserNotSubmit(Integer id) {
		return discordUserRepository.existsByIdUserAndStatus(id, ContestantStatus.DID_NOT_SUBMIT.name().toLowerCase());
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
		DiscordUser user = discordUserRepository.findByDiscordId(discordId)
			.orElseThrow(() -> new IllegalArgumentException("User with Discord ID " + discordId + " not found."));

		String hostId = systemSettingService.getHostDiscordId();

		if (user.getDiscordId().equals(hostId)) {
			user.setHost(true);
		}

		return user;
	}

}
