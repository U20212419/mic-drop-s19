package com.twokb.micdrop.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.dto.CreateRoundRequest;
import com.twokb.micdrop.dto.RoundAssignmentsResponse;
import com.twokb.micdrop.dto.UpdateRoundRequest;
import com.twokb.micdrop.dto.UserAssignmentDTO;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.service.RoundService;
import com.twokb.micdrop.service.UserRoundService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/rounds")
@RequiredArgsConstructor
public class RoundController {

	private final RoundService roundService;

	private final UserRoundService userRoundService;

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
	public ResponseEntity<List<Round>> fetchRounds() {
		return ResponseEntity.ok(roundService.getAllRounds());
	}

	@GetMapping("/{idRound}")
	@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
	public ResponseEntity<Round> fetchRoundInfo(@PathVariable Integer idRound) {
		return ResponseEntity.ok(roundService.getRound(idRound));
	}

	@GetMapping("/{idRound}/assignments")
	@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
	public ResponseEntity<RoundAssignmentsResponse> fetchRoundAssignments(@PathVariable Integer idRound) {
		return ResponseEntity.ok(userRoundService.getRoundAssignments(idRound));
	}

	@PostMapping
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<Round> createRound(@RequestBody CreateRoundRequest request) {
		Round savedRound = roundService.createRound(request.roundNumber(), request.groupCount());

		return ResponseEntity.status(HttpStatus.CREATED).body(savedRound);
	}

	@PutMapping("/{idRound}/assignments")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<RoundAssignmentsResponse> assignUsersToRound(@PathVariable Integer idRound,
			@RequestBody Map<String, List<UserAssignmentDTO>> assignmentRequest) {
		RoundAssignmentsResponse updatedAssignments = userRoundService.syncRoundAssignments(idRound,
				assignmentRequest.get("contestants"), assignmentRequest.get("judges"));

		return ResponseEntity.status(HttpStatus.OK).body(updatedAssignments);
	}

	@PostMapping("/{idRound}/auto-assign-contestants")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<RoundAssignmentsResponse> autoAssignContestants(@PathVariable Integer idRound) {
		RoundAssignmentsResponse updatedAssignments = userRoundService.autoAssignContestants(idRound);

		return ResponseEntity.status(HttpStatus.OK).body(updatedAssignments);
	}

	@PutMapping("/{idRound}")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<Round> updateRound(@PathVariable Integer idRound, @RequestBody UpdateRoundRequest request) {
		Round updatedRound = roundService.updateRound(idRound, request.roundNumber(), request.active(),
				request.groupCount());

		return ResponseEntity.status(HttpStatus.OK).body(updatedRound);
	}

	@DeleteMapping("/{idRound}")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<Void> deleteRound(@PathVariable Integer idRound) {
		roundService.deleteRound(idRound);

		return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
	}

}
