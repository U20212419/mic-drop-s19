package com.twokb.micdrop.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.UserVerifyRequest;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.RefreshToken;
import com.twokb.micdrop.service.DiscordUserService;
import com.twokb.micdrop.service.RefreshTokenService;
import com.twokb.micdrop.service.SystemSettingService;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

	private final DiscordUserService discordUserService;

	private final JwtEncoder jwtEncoder;

	private final SystemSettingService systemSettingService;

	private final RefreshTokenService refreshTokenService;

	@PostMapping("/verify")
	public ResponseEntity<Map<String, Object>> verifyUser(@RequestBody UserVerifyRequest request,
			HttpServletResponse response) {
		try {
			DiscordUser user = discordUserService.getUserByDiscordId(request.discordId());

			String hostId = systemSettingService.getHostDiscordId();
			user.setHost(user.getDiscordId().equals(hostId));

			// Only allow verification if the user is not INACTIVE
			// (i.e. they are either ACTIVE contestant, was ELIMINATED but can still
			// access the platform, or manually registered with NOT_CONTESTANT status)
			if (user.getStatus() != ContestantStatus.INACTIVE) {
				String token = generateJwtToken(user);

				// Generate raw refresh token and attach it to a secure HttpOnly cookie
				String rawRefreshToken = refreshTokenService.createRefreshToken(user.getDiscordId());

				return ResponseEntity.ok(Map.of("role", user.getGlobalRole().name(), "status", user.getStatus().name(),
						"token", token, "refreshToken", rawRefreshToken, "host", user.isHost()));
			}
			else {
				return ResponseEntity.status(HttpStatus.FORBIDDEN)
					.body(Map.of("error", "User with Discord ID " + request.discordId()
							+ " is not an active contestant or manually registered user."));
			}
		}
		catch (IllegalArgumentException ex) {
			// User not found, return 403 Forbidden with error message
			return ResponseEntity.status(HttpStatus.FORBIDDEN)
				.body(Map.of("error", "User with Discord ID " + request.discordId() + " not found."));
		}
	}

	@PostMapping("/judge-app-login")
	public ResponseEntity<Map<String, Object>> judgeAppLogin(@RequestBody UserVerifyRequest request,
			HttpServletResponse response) {
		DiscordUser user = discordUserService.loginOrRegisterUser(request.discordId(), request.username());

		String hostId = systemSettingService.getHostDiscordId();
		user.setHost(user.getDiscordId().equals(hostId));

		String token = generateJwtToken(user);

		// Generate raw refresh token and attach it to a secure HttpOnly cookie
		String rawRefreshToken = refreshTokenService.createRefreshToken(user.getDiscordId());

		return ResponseEntity.ok(Map.of("role", user.getGlobalRole().name(), "status", user.getStatus().name(), "token",
				token, "refreshToken", rawRefreshToken, "host", user.isHost()));
	}

	@PostMapping("/refresh")
	public ResponseEntity<Map<String, String>> refreshToken(@RequestBody Map<String, String> body) {
		String rawToken = body.get("refreshToken");

		if (rawToken == null || rawToken.isBlank()) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No refresh token provided."));
		}

		return refreshTokenService.verifyByRawToken(rawToken).map(RefreshToken::getDiscordId).map(discordId -> {
			DiscordUser user = discordUserService.getUserByDiscordId(discordId);

			// Re-evaluate host status for the new access token
			String hostId = systemSettingService.getHostDiscordId();
			user.setHost(user.getDiscordId().equals(hostId));

			// Issue a new short-lived access token
			String newAccessToken = generateJwtToken(user);

			return ResponseEntity.ok(Map.of("token", newAccessToken));
		}).orElseThrow(() -> new RuntimeException("Invalid refresh token. Please log in again."));
	}

	@PostMapping("/signout")
	public ResponseEntity<Map<String, String>> signout(@RequestBody Map<String, String> requestBody,
			HttpServletResponse response) {
		String discordId = requestBody.get("discordId");
		if (discordId != null) {
			refreshTokenService.deleteByDiscordId(discordId);
		}

		return ResponseEntity.ok(Map.of("message", "Successfully signed out."));
	}

	private String generateJwtToken(DiscordUser user) {
		Instant now = Instant.now();

		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer("md-backend")
			.issuedAt(now)
			.expiresAt(now.plus(30, ChronoUnit.MINUTES)) // Token valid for 30 minutes
			.subject(user.getDiscordId())
			.claim("role", user.getGlobalRole().name())
			.claim("host", user.isHost())
			.build();

		// Sign the JWT token using the configured JwtEncoder
		return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
			.getTokenValue();
	}

}
