package com.twokb.micdrop.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.twokb.micdrop.dto.DiscordBotMessageRequest;
import com.twokb.micdrop.service.DiscordBotService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/api/bot")
@RequiredArgsConstructor
public class DiscordBotController {

	private final DiscordBotService discordBotService;

	@PostMapping("/send-signup-message")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<String> sendSignupMessage(@Valid @RequestBody DiscordBotMessageRequest request,
			Principal principal) {
		discordBotService.sendSignUpMessage(request.channelId(), principal.getName());
		return ResponseEntity.ok("Signup message sent successfully to channel ID: " + request.channelId());
	}

}
