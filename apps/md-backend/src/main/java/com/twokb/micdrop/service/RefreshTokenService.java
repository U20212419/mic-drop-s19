package com.twokb.micdrop.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.twokb.micdrop.model.RefreshToken;
import com.twokb.micdrop.repository.RefreshTokenRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

	private final RefreshTokenRepository refreshTokenRepository;

	private String hashToken(String token) {
		if (token == null || token.isBlank()) {
			throw new IllegalArgumentException("Token cannot be null or blank for hashing.");
		}

		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] encodedHash = digest.digest(token.getBytes(StandardCharsets.UTF_8));

			// Convert byte array to hex string
			StringBuilder hexString = new StringBuilder(2 * encodedHash.length);
			for (byte b : encodedHash) {
				String hex = Integer.toHexString(0xff & b);
				if (hex.length() == 1) {
					hexString.append('0');
				}
				hexString.append(hex);
			}
			return hexString.toString();
		}
		catch (Exception e) {
			throw new RuntimeException("Error hashing refresh token.", e);
		}
	}

	@Transactional
	public String createRefreshToken(String discordId) {
		// Search for an existing token for the user and use it if found, otherwise create
		// a new one
		RefreshToken refreshToken = refreshTokenRepository.findByDiscordId(discordId).orElse(new RefreshToken());

		// Generate the raw token
		String rawToken = UUID.randomUUID().toString();

		// Hash the token before saving to the database
		String hashedToken = hashToken(rawToken);

		refreshToken.setDiscordId(discordId);
		refreshToken.setTokenHash(hashedToken);
		// Set expiry date to 7 days from now
		refreshToken.setExpiryDate(Instant.now().plusSeconds(7 * 24 * 60 * 60));

		refreshTokenRepository.save(refreshToken);

		return rawToken; // Return the raw token to be sent to the client
	}

	public Optional<RefreshToken> verifyByRawToken(String rawToken) {
		String hashedToken = hashToken(rawToken);

		return refreshTokenRepository.findByTokenHash(hashedToken).map(token -> {
			if (token.getExpiryDate().isBefore(Instant.now())) {
				// Token has expired, delete it from the database
				refreshTokenRepository.delete(token);
				throw new RuntimeException("Refresh token has expired. Please log in again.");
			}
			return token;
		});
	}

	@Transactional
	public void deleteByDiscordId(String discordId) {
		refreshTokenRepository.deleteByDiscordId(discordId);
	}

}
