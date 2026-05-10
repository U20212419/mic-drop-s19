package com.twokb.micdrop.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.JudgeAppDTO;
import com.twokb.micdrop.service.JudgeAppService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/judge-apps")
@RequiredArgsConstructor
public class JudgeAppController {

	private final JudgeAppService judgeAppService;

	@GetMapping("/my-app")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<JudgeAppDTO> getMyJudgeApp(Principal principal) {
		return judgeAppService.getJudgeAppByDiscordId(principal.getName())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@PostMapping
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<Void> submitJudgeApp(Principal principal, @Valid @RequestBody JudgeAppDTO request) {
		judgeAppService.submitOrUpdateJudgeApp(principal.getName(), request);
		return ResponseEntity.ok().build();
	}

}
