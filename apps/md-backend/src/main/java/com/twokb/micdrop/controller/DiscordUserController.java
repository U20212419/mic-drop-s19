package com.twokb.micdrop.controller;

import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.CreateUserRequest;
import com.twokb.micdrop.dto.UpdateUserRequest;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.service.DiscordUserService;

import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class DiscordUserController {

	private final DiscordUserService discordUserService;

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
	public ResponseEntity<List<DiscordUser>> fetchUsers() {
		return ResponseEntity.ok(discordUserService.getAllUsers());
	}

	@PostMapping
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordUser> createUser(@RequestBody CreateUserRequest request) {
		DiscordUser savedUser = discordUserService.registerUser(request.discordId(), request.username(),
				request.globalRole());

		return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
	}

	@PutMapping("/{idUser}")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordUser> updateUser(@PathVariable Integer idUser,
			@RequestBody UpdateUserRequest request) {
		DiscordUser updatedUser = discordUserService.updateUser(idUser, request.discordId(), request.username(),
				request.status(), request.globalRole());

		return ResponseEntity.status(HttpStatus.OK).body(updatedUser);
	}

	@DeleteMapping("/{idUser}")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<Void> deleteUser(@PathVariable Integer idUser) {
		discordUserService.deleteUser(idUser);

		return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
	}

}
