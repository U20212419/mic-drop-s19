package com.twokb.micdrop.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.service.RefreshTokenService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class SessionController {

	private final RefreshTokenService refreshTokenService;

	@PostMapping("/signout")
	public ResponseEntity<Map<String, String>> signout(Principal principal) {
		if (principal != null && principal.getName() != null) {
			refreshTokenService.deleteByDiscordId(principal.getName());
		}
		return ResponseEntity.ok(Map.of("message", "Successfully signed out."));
	}

}
