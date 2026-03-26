package com.twokb.micdrop.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.twokb.micdrop.dto.DiscordBotMessageRequest;
import com.twokb.micdrop.service.DiscordBotService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class DiscordBotController {

	private final DiscordBotService discordBotService;

	@PostMapping("/bot/send-singup-message")
	public ResponseEntity<String> sendSignupMessage(@Valid @RequestBody DiscordBotMessageRequest request) {
		try {
			discordBotService.sendSingUpMessage(request.channelId());
			return ResponseEntity.ok("Signup message sent successfully to channel ID: " + request.channelId());
		}
		catch (IllegalArgumentException e) {
			return ResponseEntity.badRequest().body("Error: " + e.getMessage());
		}
		catch (Exception e) {
			return ResponseEntity.internalServerError().body("Failed to send signup message: " + e.getMessage());
		}
	}

}
