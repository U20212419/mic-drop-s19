package com.twokb.micdrop.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.stats.PublicStatResponseDTO;
import com.twokb.micdrop.service.PublicStatsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/public/stats")
@RequiredArgsConstructor
public class PublicStatsController {

	private final PublicStatsService publicStatsService;

	@GetMapping
	public ResponseEntity<PublicStatResponseDTO> getLeaderboard() {
		return ResponseEntity.ok(publicStatsService.getPublicStats());
	}

}
