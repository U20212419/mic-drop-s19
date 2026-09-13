package com.twokb.micdrop.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.twokb.micdrop.exception.InvalidTokenException;
import com.twokb.micdrop.model.RefreshToken;
import com.twokb.micdrop.repository.RefreshTokenRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

	private final RefreshTokenRepository refreshTokenRepository;

	public record RefreshTokenRotationResult(String discordId, String newRawRefreshToken) {
	}

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
		refreshToken.setExpiryDate(Instant.now().plus(7, ChronoUnit.DAYS)); // Duration of
																			// 7 days for
																			// refresh
																			// token
																			// validity

		refreshTokenRepository.save(refreshToken);

		return rawToken; // Return the raw token to be sent to the client
	}

	@Transactional
	public RefreshTokenRotationResult rotateRefreshToken(String rawToken) {
		String hashedToken = hashToken(rawToken);

		RefreshToken token = refreshTokenRepository.findByTokenHash(hashedToken)
			.orElseThrow(() -> new InvalidTokenException("Refresh token not found. Please log in again."));

		// Verify if the token has already passed the inactivity threshold
		if (token.getExpiryDate().isBefore(Instant.now())) {
			refreshTokenRepository.delete(token);
			throw new InvalidTokenException("Refresh token has expired due to inactivity. Please log in again.");
		}

		// Generate a new raw token for rotation
		String newRawToken = UUID.randomUUID().toString();
		String newHashedToken = hashToken(newRawToken);

		// Update hash and slide expiration window
		token.setTokenHash(newHashedToken);
		token.setExpiryDate(Instant.now().plus(7, ChronoUnit.DAYS)); // Slide the
																		// expiration
																		// window by 7
																		// days from now
		refreshTokenRepository.save(token);

		return new RefreshTokenRotationResult(token.getDiscordId(), newRawToken);
	}

	@Transactional
	public void deleteByDiscordId(String discordId) {
		refreshTokenRepository.deleteByDiscordId(discordId);
	}

}
