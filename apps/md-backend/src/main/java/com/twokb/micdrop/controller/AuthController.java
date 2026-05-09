package com.twokb.micdrop.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.UserVerifyRequest;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.service.DiscordUserService;

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

	@PostMapping("/verify")
	public ResponseEntity<Map<String, String>> verifyUser(@RequestBody UserVerifyRequest request) {
		try {
			DiscordUser user = discordUserService.getUserByDiscordId(request.discordId());

			// Only allow verification if the user is not INACTIVE
			// (i.e. they are either ACTIVE contestant, was ELIMINATED but can still
			// access the platform, or manually registered with NOT_CONTESTANT status)
			if (user.getStatus() != ContestantStatus.INACTIVE) {
				// Create JWT token with user role as a claim
				Instant now = Instant.now();

				JwtClaimsSet claims = JwtClaimsSet.builder()
					.issuer("md-backend")
					.issuedAt(now)
					.expiresAt(now.plus(24, ChronoUnit.HOURS)) // Token valid for 1 day
					.subject(user.getDiscordId())
					.claim("role", user.getGlobalRole().name())
					.build();

				// Sign the JWT token using the configured JwtEncoder
				String token = jwtEncoder
					.encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
					.getTokenValue();

				return ResponseEntity.ok(Map.of("role", user.getGlobalRole().name(), "token", token));
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

}
