package com.twokb.micdrop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.repository.DiscordUserRepository;
import com.twokb.micdrop.repository.SubmissionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DiscordUserService {

	private final DiscordUserRepository discordUserRepository;

	private final SubmissionRepository submissionRepository;

	@Transactional
	public void registerUser(String discordId, String username) {
		discordUserRepository.findByDiscordId(discordId).ifPresentOrElse(
			user -> {
				// User already registered: change status to ACTIVE if they were INACTIVE
				if (user.getStatus() == ContestantStatus.INACTIVE) {
					user.setStatus(ContestantStatus.ACTIVE);
				}
			},
			() -> {
				// New user: create with ACTIVE status
				var user = new DiscordUser();
				user.setDiscordId(discordId);
				user.setUsername(username);
				user.setStatus(ContestantStatus.ACTIVE);
				discordUserRepository.save(user);
			}
		);
	}

	@Transactional
	public boolean unregisterUser(String discordId) {
		// Only allow unregistering if the user has not submitted any entries
		if (submissionRepository.existsByContestant_User_DiscordId(discordId)) {
			return false; // User has submissions, cannot unregister
		}

		// Mark user as INACTIVE instead of deleting
		return discordUserRepository.findByDiscordId(discordId)
			.map(user -> {
				user.setStatus(ContestantStatus.INACTIVE);
				return true; // Successfully marked as INACTIVE
			})
			.orElse(false); // User not found
	}

	@Transactional
	public void eliminateUser(String discordId) {
		discordUserRepository.findByDiscordId(discordId)
			.ifPresent(user -> user.setStatus(ContestantStatus.ELIMINATED));
	}
}
