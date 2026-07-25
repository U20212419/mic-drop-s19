package com.twokb.micdrop.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.twokb.micdrop.dto.DiscordBotMessageRequest;
import com.twokb.micdrop.dto.DiscordJudgingReminderRequest;
import com.twokb.micdrop.dto.DiscordJudgingReminderResponse;
import com.twokb.micdrop.dto.DiscordSubmissionReminderConfig;
import com.twokb.micdrop.dto.DiscordSubmissionReminderRequest;
import com.twokb.micdrop.service.DiscordBotService;
import com.twokb.micdrop.service.DiscordSubmissionReminderService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/api/bot")
@RequiredArgsConstructor
public class DiscordBotController {

	private final DiscordBotService discordBotService;

	private final DiscordSubmissionReminderService discordSubmissionReminderService;

	@PostMapping("/send-signup-message")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<String> sendSignupMessage(@Valid @RequestBody DiscordBotMessageRequest request,
			Principal principal) {
		discordBotService.sendSignUpMessage(request.channelId(), principal.getName());
		return ResponseEntity.ok("Signup message sent successfully to channel ID: " + request.channelId());
	}

	@PostMapping("/send-judging-reminder")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordJudgingReminderResponse> sendJudgingReminder(
			@Valid @RequestBody DiscordJudgingReminderRequest request, Principal principal) {
		return ResponseEntity.ok(
				discordBotService.sendJudgingReminder(request.channelId(), request.deadline(), principal.getName()));
	}

	@GetMapping("/submission-reminder-schedule")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordSubmissionReminderConfig> getSubmissionReminderSchedule() {
		return ResponseEntity.ok(discordSubmissionReminderService.getConfig());
	}

	@PutMapping("/submission-reminder-schedule")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordSubmissionReminderConfig> configureSubmissionReminderSchedule(
			@Valid @RequestBody DiscordSubmissionReminderRequest request, Principal principal) {
		return ResponseEntity.ok(discordSubmissionReminderService.configure(request.channelId(), request.deadline(),
				principal.getName()));
	}

	@DeleteMapping("/submission-reminder-schedule")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<DiscordSubmissionReminderConfig> disableSubmissionReminderSchedule(Principal principal) {
		return ResponseEntity.ok(discordSubmissionReminderService.disable(principal.getName()));
	}

}
