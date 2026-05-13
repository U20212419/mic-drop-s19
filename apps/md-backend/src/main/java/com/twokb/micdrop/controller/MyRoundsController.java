package com.twokb.micdrop.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.myRounds.BatchScoreRequest;
import com.twokb.micdrop.dto.myRounds.BatchSubmissionRequest;
import com.twokb.micdrop.dto.myRounds.ContestantRoundDetailDTO;
import com.twokb.micdrop.dto.myRounds.JudgeRoundDetailDTO;
import com.twokb.micdrop.dto.myRounds.MyRoundDTO;
import com.twokb.micdrop.service.MyRoundsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/my-rounds")
@RequiredArgsConstructor
public class MyRoundsController {

	private final MyRoundsService myRoundsService;

	@GetMapping
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<List<MyRoundDTO>> getMyRounds(Principal principal) {
		return ResponseEntity.ok(myRoundsService.getMyRounds(principal.getName()));
	}

	@GetMapping("/{idRound}/contestant-detail")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<ContestantRoundDetailDTO> getContestantDetail(@PathVariable Integer idRound,
			Principal principal) {
		return ResponseEntity.ok(myRoundsService.getContestantDetail(idRound, principal.getName()));
	}

	@GetMapping("/{idRound}/judge-detail")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<JudgeRoundDetailDTO> getJudgeDetail(@PathVariable Integer idRound, Principal principal) {
		return ResponseEntity.ok(myRoundsService.getJudgeDetail(idRound, principal.getName()));
	}

	@PostMapping("/batch-submit")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<Void> submitLinks(@RequestBody BatchSubmissionRequest request, Principal principal) {
		myRoundsService.submitLinks(request, principal.getName());
		return ResponseEntity.ok().build();
	}

	@PutMapping("/batch-score")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<Void> submitScores(@RequestBody BatchScoreRequest request, Principal principal) {
		myRoundsService.submitScores(request, principal.getName());
		return ResponseEntity.ok().build();
	}

}
