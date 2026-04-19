package com.twokb.micdrop.controller;

import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.CreateUserRequest;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.service.DiscordUserService;

import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class DiscordUserController {

	private final DiscordUserService discordUserService;

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
	public ResponseEntity<List<DiscordUser>> getAllUsers() {
		return ResponseEntity.ok(discordUserService.getAllUsers());
	}

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> createUser(@RequestBody CreateUserRequest request) {
        try {
            discordUserService.registerUser(request.discordId(), request.username(), request.globalRole());
            return ResponseEntity.ok("User registered successfully.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
    
}
